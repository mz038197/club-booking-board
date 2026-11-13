import { maskDisplayName } from "@/board/mask";
import type { MonitorCall, MonitorRosterEntry, MonitorSnapshot } from "@/board/snapshot";
import { apiCallsOf } from "./call-log";
import type { Db } from "./db";
import { boardOf, sessionCols, toSession, type Session, type SessionRow } from "./sessions";
import { rosterOf } from "./students";

/** 投影監看 data: 投影顯示設定 and the monitor snapshot of a 堂課. */

/** How many API 呼叫紀錄 rows the monitor shows (newest). */
export const MONITOR_CALL_LIMIT = 200;

/** Changes the 投影顯示設定 fields given; returns the 堂課 with the new values. */
export async function setDisplaySettings(
  db: Db,
  sessionId: string,
  change: { maskNames?: boolean; autoFollow?: boolean },
): Promise<Session> {
  const [row] = await db.query<SessionRow>(
    `UPDATE sessions
        SET mask_names = COALESCE($2, mask_names), auto_follow = COALESCE($3, auto_follow)
      WHERE id = $1
      RETURNING ${sessionCols()}`,
    [sessionId, change.maskNames ?? null, change.autoFollow ?? null],
  );
  return toSession(row);
}

/**
 * Everything the 投影監看頁 shows for a 堂課: 看板, 名冊進度 and the newest API 呼叫紀錄.
 * With 遮蔽名稱 on, every 顯示名稱 is masked here, so full names never reach the projector.
 */
export async function monitorSnapshot(db: Db, session: Session): Promise<MonitorSnapshot> {
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
  return (await rosterOf(db, sessionId)).map((r) => ({
    student_id: r.studentId,
    display_name: r.displayName,
    first_call_at: r.firstCallAt,
    first_booked_at: r.firstBookedAt,
    booked_count: r.bookedCount,
    rooms: r.rooms,
  }));
}

/**
 * The newest API 呼叫紀錄, newest first. A successful bookSlot whose student's
 * previous bookSlot failed is marked `retry` (換格重試, the RTR scenario).
 */
async function recentCallsOf(db: Db, sessionId: string): Promise<MonitorCall[]> {
  const oldestFirst = await apiCallsOf(db, sessionId, { newest: MONITOR_CALL_LIMIT });
  const lastBookFailed = new Map<number, boolean>();
  const calls = oldestFirst.map((c) => {
    let retry = false;
    if (c.action === "bookSlot") {
      const ok = c.status >= 200 && c.status < 300;
      retry = ok && lastBookFailed.get(c.studentId) === true;
      lastBookFailed.set(c.studentId, !ok);
    }
    return {
      id: c.id,
      at: c.at,
      student_id: c.studentId,
      display_name: c.displayName,
      action: c.action,
      slot_id: c.slotId,
      status: c.status,
      code: c.code,
      retry,
    };
  });
  return calls.reverse();
}
