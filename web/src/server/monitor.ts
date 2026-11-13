import { maskDisplayName } from "@/board/mask";
import type { MonitorCall, MonitorRosterEntry, MonitorSnapshot } from "@/board/snapshot";
import type { Db } from "./db";
import { boardOf } from "./sessions";

/** How many API 呼叫紀錄 rows the monitor shows (newest). */
export const MONITOR_CALL_LIMIT = 200;

/** 投影監看 data: a 堂課 with its 投影顯示設定, and the monitor snapshot. */

export type MonitorSession = {
  id: string;
  classId: number;
  name: string;
  paused: boolean;
  /** 投影顯示設定: 遮蔽名稱 (projection only; never the 分享連結) */
  maskNames: boolean;
  /** 投影顯示設定: default of 「有人預約時自動跳到那一天」 */
  autoFollow: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SessionRow = {
  id: string;
  class_id: number;
  name: string;
  paused: boolean;
  mask_names: boolean;
  auto_follow: boolean;
};

const SESSION_COLUMNS = "id, class_id, name, paused, mask_names, auto_follow";

const toSession = (r: SessionRow): MonitorSession => ({
  id: r.id,
  classId: r.class_id,
  name: r.name,
  paused: r.paused,
  maskNames: r.mask_names,
  autoFollow: r.auto_follow,
});

/** A 堂課 by id (`null` when unknown or not a uuid). */
export async function monitorSessionOf(db: Db, sessionId: string): Promise<MonitorSession | null> {
  if (!UUID.test(sessionId)) return null;
  const [row] = await db.query<SessionRow>(`SELECT ${SESSION_COLUMNS} FROM sessions WHERE id = $1`, [
    sessionId,
  ]);
  return row ? toSession(row) : null;
}

/** Changes the 投影顯示設定 fields given; returns the 堂課 with the new values. */
export async function setDisplaySettings(
  db: Db,
  sessionId: string,
  change: { maskNames?: boolean; autoFollow?: boolean },
): Promise<MonitorSession> {
  const [row] = await db.query<SessionRow>(
    `UPDATE sessions
        SET mask_names = COALESCE($2, mask_names), auto_follow = COALESCE($3, auto_follow)
      WHERE id = $1
      RETURNING ${SESSION_COLUMNS}`,
    [sessionId, change.maskNames ?? null, change.autoFollow ?? null],
  );
  return toSession(row);
}

/**
 * Everything the 投影監看頁 shows for a 堂課: 看板, 名冊進度 and the newest API 呼叫紀錄.
 * With 遮蔽名稱 on, every 顯示名稱 is masked here, so full names never reach the projector.
 */
export async function monitorSnapshot(db: Db, session: MonitorSession): Promise<MonitorSnapshot> {
  const name = session.maskNames ? maskDisplayName : (n: string) => n;
  const slots = await boardOf(db, session.id);
  const roster = await rosterProgressOf(db, session.id);
  const calls = await recentCallsOf(db, session.id);
  return {
    session: { id: session.id, name: session.name, class_id: session.classId, paused: session.paused },
    settings: { mask_names: session.maskNames, auto_follow: session.autoFollow },
    slots: slots.map((s) => (s.booked_by === undefined ? s : { ...s, booked_by: name(s.booked_by) })),
    roster: roster.map((r) => ({ ...r, display_name: name(r.display_name) })),
    calls: calls.map((c) => ({ ...c, display_name: name(c.display_name) })),
  };
}

/** 名冊 (by first call) with each student's current 可借格 count and 教室 (in booking order). */
async function rosterProgressOf(db: Db, sessionId: string): Promise<MonitorRosterEntry[]> {
  const rows = await db.query<{
    student_id: number;
    display_name: string;
    first_call_at: Date | string;
    first_booked_at: Date | string | null;
    rooms: string[] | null;
  }>(
    `SELECT ss.student_id, st.display_name, ss.first_call_at, ss.first_booked_at,
            (SELECT array_agg(sl.room ORDER BY b.created_at, b.slot_id)
               FROM bookings b
               JOIN slots sl ON sl.session_id = b.session_id AND sl.slot_id = b.slot_id
              WHERE b.session_id = ss.session_id AND b.student_id = ss.student_id) AS rooms
       FROM session_students ss JOIN students st ON st.student_id = ss.student_id
      WHERE ss.session_id = $1
      ORDER BY ss.first_call_at, ss.student_id`,
    [sessionId],
  );
  return rows.map((r) => ({
    student_id: r.student_id,
    display_name: r.display_name,
    first_call_at: new Date(r.first_call_at).toISOString(),
    first_booked_at: r.first_booked_at ? new Date(r.first_booked_at).toISOString() : null,
    booked_count: r.rooms?.length ?? 0,
    rooms: r.rooms ?? [],
  }));
}

/**
 * The newest API 呼叫紀錄, newest first. A successful bookSlot whose student's
 * previous bookSlot failed is marked `retry` (換格重試, the RTR scenario).
 */
async function recentCallsOf(db: Db, sessionId: string): Promise<MonitorCall[]> {
  const rows = await db.query<{
    id: number | string;
    at: Date | string;
    student_id: number;
    display_name: string;
    action: string;
    slot_id: string | null;
    http_status: number;
    code: string | null;
  }>(
    `SELECT c.id, c.at, c.student_id, s.display_name, c.action, c.slot_id, c.http_status, c.code
       FROM api_calls c JOIN students s ON s.student_id = c.student_id
      WHERE c.session_id = $1
      ORDER BY c.at DESC, c.id DESC
      LIMIT ${MONITOR_CALL_LIMIT}`,
    [sessionId],
  );
  const lastBookFailed = new Map<number, boolean>();
  const oldestFirst = rows.reverse().map((r) => {
    let retry = false;
    if (r.action === "bookSlot") {
      const ok = r.http_status >= 200 && r.http_status < 300;
      retry = ok && lastBookFailed.get(r.student_id) === true;
      lastBookFailed.set(r.student_id, !ok);
    }
    return {
      id: Number(r.id),
      at: new Date(r.at).toISOString(),
      student_id: r.student_id,
      display_name: r.display_name,
      action: r.action,
      slot_id: r.slot_id,
      status: r.http_status,
      code: r.code,
      retry,
    };
  });
  return oldestFirst.reverse();
}
