import type { Db } from "./db";
import { ApiError } from "./http/errors";

/** 堂課 / 目前堂課 / 可借格 data access. */

export type Session = {
  id: string;
  classId: number;
  name: string;
  paused: boolean;
  /** 預約規則: 每人上限 (1–5) */
  perStudentLimit: number;
  /** 預約規則: 上課當天可預約與取消的時間窗 (Asia/Taipei HH:MM, start inclusive, end exclusive); null = 不限 */
  bookingWindow: BookingWindow | null;
  /** 投影顯示設定: 遮蔽名稱 (投影監看頁 only; never the 分享連結 or the student API) */
  maskNames: boolean;
  /** 投影顯示設定: default of 「有人預約時自動跳到那一天」 */
  autoFollow: boolean;
};

export type BookingWindow = { start: string; end: string };

export type SlotInput = { date: string; start: string; end: string; room: string };

export type BoardSlot = {
  slot_id: string;
  date: string;
  start: string;
  end: string;
  room: string;
  status: "open" | "booked";
  booked_by?: string;
};

export function makeSlotId(slot: SlotInput): string {
  return `${slot.date}_${slot.start}-${slot.end}_${slot.room}`;
}

type SessionRow = {
  id: string;
  class_id: number;
  name: string;
  paused: boolean;
  per_student_limit: number;
  booking_window_start: string | null;
  booking_window_end: string | null;
  mask_names: boolean;
  auto_follow: boolean;
};

/** The `sessions` columns `toSession` reads (prefix with an alias via `sessionCols("s")`). */
export const sessionCols = (alias = "") =>
  [
    "id",
    "class_id",
    "name",
    "paused",
    "per_student_limit",
    "booking_window_start",
    "booking_window_end",
    "mask_names",
    "auto_follow",
  ]
    .map((c) => (alias ? `${alias}.${c}` : c))
    .join(", ");

export const toSession = (r: SessionRow): Session => ({
  id: r.id,
  classId: r.class_id,
  name: r.name,
  paused: r.paused,
  perStudentLimit: r.per_student_limit,
  bookingWindow:
    r.booking_window_start && r.booking_window_end
      ? { start: r.booking_window_start, end: r.booking_window_end }
      : null,
  maskNames: r.mask_names,
  autoFollow: r.auto_follow,
});

export type { SessionRow };

/**
 * 預約規則 columns a new 堂課 copies from the 堂課 it is based on (可借清單 is copied
 * separately; 預約 never; 暫停 never). Add new rule columns here.
 */
export const COPIED_RULE_COLUMNS = ["per_student_limit", "booking_window_start", "booking_window_end"] as const;

/**
 * Creates a 堂課; it becomes its class's 目前堂課. With `copyFrom` (a 堂課 of the
 * same 班級) it starts with that 堂課's 可借清單 and 預約規則, without its 預約.
 * Throws 400 INVALID_REQUEST when `copyFrom` is not a 堂課 of this 班級.
 */
export async function createSession(
  db: Db,
  input: { classId: number; name: string; copyFrom?: string },
): Promise<Session> {
  return db.transaction(async (tx) => {
    let row: SessionRow | undefined;
    if (input.copyFrom) {
      const cols = COPIED_RULE_COLUMNS.join(", ");
      [row] = await tx.query<SessionRow>(
        `INSERT INTO sessions (class_id, name, ${cols})
         SELECT class_id, $2, ${cols} FROM sessions WHERE id = $3 AND class_id = $1
         RETURNING ${sessionCols()}`,
        [input.classId, input.name, input.copyFrom],
      );
      if (!row) throw new ApiError(400, "INVALID_REQUEST", "要複製的堂課不在這個班級");
      await tx.query(
        `INSERT INTO slots (session_id, slot_id, date, start_time, end_time, room)
         SELECT $1, slot_id, date, start_time, end_time, room FROM slots WHERE session_id = $2`,
        [row.id, input.copyFrom],
      );
    } else {
      [row] = await tx.query<SessionRow>(
        `INSERT INTO sessions (class_id, name) VALUES ($1, $2)
         RETURNING ${sessionCols()}`,
        [input.classId, input.name],
      );
    }
    await setCurrent(tx, input.classId, row.id);
    return toSession(row);
  });
}

async function setCurrent(db: Db, classId: number, sessionId: string): Promise<void> {
  await db.query(
    `INSERT INTO class_current_sessions (class_id, session_id) VALUES ($1, $2)
     ON CONFLICT (class_id) DO UPDATE SET session_id = EXCLUDED.session_id`,
    [classId, sessionId],
  );
}

/** Makes a 堂課 its 班級's 目前堂課 (e.g. switching back to an older one). */
export async function makeCurrentSession(db: Db, session: Session): Promise<void> {
  await setCurrent(db, session.classId, session.id);
}

/** 暫停／恢復 a 堂課's 預約 and 取消 (queries are unaffected). */
export async function setPaused(db: Db, sessionId: string, paused: boolean): Promise<void> {
  await db.query(`UPDATE sessions SET paused = $2 WHERE id = $1`, [sessionId, paused]);
}

/** Sets a 堂課's 預約規則 (每人上限 1–5, 時間窗 or null). Validate first (`parseBookingRules`). */
export async function setBookingRules(
  db: Db,
  sessionId: string,
  rules: { perStudentLimit: number; bookingWindow: BookingWindow | null },
): Promise<void> {
  await db.query(
    `UPDATE sessions SET per_student_limit = $2, booking_window_start = $3, booking_window_end = $4 WHERE id = $1`,
    [sessionId, rules.perStudentLimit, rules.bookingWindow?.start ?? null, rules.bookingWindow?.end ?? null],
  );
}

export async function sessionById(db: Db, id: string): Promise<Session | null> {
  const [row] = await db.query<SessionRow>(
    `SELECT ${sessionCols()} FROM sessions WHERE id = $1`,
    [id],
  );
  return row ? toSession(row) : null;
}

export type SessionSummary = {
  id: string;
  name: string;
  /** ISO time */
  createdAt: string;
  isCurrent: boolean;
  slotCount: number;
};

/** A 班級's 堂課, newest first, with the 目前堂課 marked. */
export async function sessionsOfClass(db: Db, classId: number): Promise<SessionSummary[]> {
  const rows = await db.query<{
    id: string;
    name: string;
    created_at: Date | string;
    is_current: boolean;
    slot_count: number | string;
  }>(
    `SELECT s.id, s.name, s.created_at, (c.session_id IS NOT NULL) AS is_current,
            (SELECT count(*) FROM slots sl WHERE sl.session_id = s.id) AS slot_count
       FROM sessions s
       LEFT JOIN class_current_sessions c ON c.session_id = s.id
      WHERE s.class_id = $1
      ORDER BY s.created_at DESC, s.id`,
    [classId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: new Date(r.created_at).toISOString(),
    isCurrent: r.is_current,
    slotCount: Number(r.slot_count),
  }));
}

/** Adds 可借格 to a 堂課, skipping ones it already has. */
export async function addSlots(db: Db, sessionId: string, slots: SlotInput[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const slot of slots) {
      await tx.query(
        `INSERT INTO slots (session_id, slot_id, date, start_time, end_time, room)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (session_id, slot_id) DO NOTHING`,
        [sessionId, makeSlotId(slot), slot.date, slot.start, slot.end, slot.room],
      );
    }
  });
}

export async function currentSessionOf(db: Db, classId: number): Promise<Session | null> {
  const [row] = await db.query<SessionRow>(
    `SELECT ${sessionCols("s")}
       FROM class_current_sessions c JOIN sessions s ON s.id = c.session_id
      WHERE c.class_id = $1`,
    [classId],
  );
  return row ? toSession(row) : null;
}

/** 看板: every 可借格 of a 堂課 with its booking state and the booker's 顯示名稱. */
export async function boardOf(db: Db, sessionId: string): Promise<BoardSlot[]> {
  const rows = await db.query<{
    slot_id: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    display_name: string | null;
    booked: boolean;
  }>(
    `SELECT s.slot_id, s.date, s.start_time, s.end_time, s.room,
            st.display_name, (b.id IS NOT NULL) AS booked
       FROM slots s
       LEFT JOIN bookings b ON b.session_id = s.session_id AND b.slot_id = s.slot_id
       LEFT JOIN students st ON st.student_id = b.student_id
      WHERE s.session_id = $1
      ORDER BY s.date, s.start_time, s.room`,
    [sessionId],
  );
  return rows.map((r) => ({
    slot_id: r.slot_id,
    date: r.date,
    start: r.start_time,
    end: r.end_time,
    room: r.room,
    status: r.booked ? "booked" : "open",
    ...(r.booked ? { booked_by: r.display_name ?? "" } : {}),
  }));
}
