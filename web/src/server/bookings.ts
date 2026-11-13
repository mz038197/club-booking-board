import type { Db } from "./db";
import { ApiError } from "./http/errors";
import { limitReachedMessage } from "./booking-rules";
import { recordFirstBooking } from "./students";

const FOREIGN_KEY_VIOLATION = "23503";

/** 預約 data access. One 預約 per 可借格 is guaranteed by UNIQUE (session_id, slot_id). */

export type Booking = {
  booking_id: string;
  slot_id: string;
  date: string;
  start: string;
  end: string;
  room: string;
  booked_at: string;
};

type BookingRow = {
  id: string;
  slot_id: string;
  date: string;
  start_time: string;
  end_time: string;
  room: string;
  created_at: Date | string;
};

const toBooking = (r: BookingRow): Booking => ({
  booking_id: r.id,
  slot_id: r.slot_id,
  date: r.date,
  start: r.start_time,
  end: r.end_time,
  room: r.room,
  booked_at: new Date(r.created_at).toISOString(),
});

/**
 * Books a 可借格 of a 堂課 for a student.
 * Throws 400 INVALID_SLOT (not a 可借格 of this 堂課) / 409 LIMIT_REACHED (每人上限) / 409 SLOT_TAKEN.
 * The student must already be on the 名冊 (`recordFirstCall`): their row is the per-student lock.
 */
export async function bookSlot(
  db: Db,
  input: { sessionId: string; slotId: string; studentId: number; now: Date },
): Promise<Booking> {
  const invalidSlot = new ApiError(400, "INVALID_SLOT", "此堂課沒有這個可借格");
  return db.transaction(async (tx) => {
    // FOR KEY SHARE: a teacher's 移除 / 覆寫 (which lock the 可借格 FOR UPDATE) either
    // waits for this 預約 (and then sees it 已借) or deletes first (and we see no 可借格).
    const [slot] = await tx.query<{ date: string; start_time: string; end_time: string; room: string }>(
      `SELECT date, start_time, end_time, room FROM slots WHERE session_id = $1 AND slot_id = $2 FOR KEY SHARE`,
      [input.sessionId, input.slotId],
    );
    if (!slot) throw invalidSlot;

    // 每人上限: lock the student's 名冊 row so their simultaneous 預約 count one at a time.
    // Count in a separate statement: under READ COMMITTED it then sees 預約 committed while we waited.
    const locked = await tx.query(
      `SELECT 1 FROM session_students WHERE session_id = $1 AND student_id = $2 FOR UPDATE`,
      [input.sessionId, input.studentId],
    );
    if (locked.length === 0) throw new Error("bookSlot: student is not on the 堂課's 名冊 (recordFirstCall first)");
    const [limits] = await tx.query<{ per_student_limit: number; booked: number | string }>(
      `SELECT se.per_student_limit,
              (SELECT count(*) FROM bookings b WHERE b.session_id = se.id AND b.student_id = $2) AS booked
         FROM sessions se WHERE se.id = $1`,
      [input.sessionId, input.studentId],
    );
    if (Number(limits.booked) >= limits.per_student_limit) {
      throw new ApiError(409, "LIMIT_REACHED", limitReachedMessage(limits.per_student_limit));
    }

    let row: { id: string; created_at: Date | string } | undefined;
    try {
      [row] = await tx.query<{ id: string; created_at: Date | string }>(
        `INSERT INTO bookings (session_id, slot_id, student_id, created_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id, slot_id) DO NOTHING
         RETURNING id, created_at`,
        [input.sessionId, input.slotId, input.studentId, input.now],
      );
    } catch (error) {
      // The 可借格 vanished under us (foreign key to slots): treat as not a 可借格.
      if ((error as { code?: unknown }).code === FOREIGN_KEY_VIOLATION) throw invalidSlot;
      throw error;
    }
    if (!row) throw new ApiError(409, "SLOT_TAKEN", "這個可借格已經被借走了，請換一格");
    await recordFirstBooking(tx, input.sessionId, input.studentId, input.now);
    return toBooking({ ...slot, ...row, slot_id: input.slotId });
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cancels a student's own 預約 in a 堂課; returns its slot_id.
 * Throws 404 NOT_FOUND (no such 預約 in this 堂課) / 403 NOT_OWNER.
 */
export async function cancelBooking(
  db: Db,
  input: {
    sessionId: string;
    bookingId: string;
    studentId: number;
    /** Called with the 預約's slot_id once found (before the owner check). */
    onFound?: (slotId: string) => void;
  },
): Promise<string> {
  const notFound = new ApiError(404, "NOT_FOUND", "找不到這筆預約");
  if (!UUID.test(input.bookingId)) throw notFound;
  return db.transaction(async (tx) => {
    const [row] = await tx.query<{ slot_id: string; student_id: number }>(
      `SELECT slot_id, student_id FROM bookings WHERE id = $1 AND session_id = $2 FOR UPDATE`,
      [input.bookingId, input.sessionId],
    );
    if (!row) throw notFound;
    input.onFound?.(row.slot_id);
    if (row.student_id !== input.studentId) {
      throw new ApiError(403, "NOT_OWNER", "只能取消自己的預約");
    }
    await tx.query(`DELETE FROM bookings WHERE id = $1`, [input.bookingId]);
    return row.slot_id;
  });
}

/** 我的預約: a student's 預約 in a 堂課, in board order. */
export async function bookingsOf(db: Db, sessionId: string, studentId: number): Promise<Booking[]> {
  const rows = await db.query<BookingRow>(
    `SELECT b.id, b.slot_id, s.date, s.start_time, s.end_time, s.room, b.created_at
       FROM bookings b
       JOIN slots s ON s.session_id = b.session_id AND s.slot_id = b.slot_id
      WHERE b.session_id = $1 AND b.student_id = $2
      ORDER BY s.date, s.start_time, s.room`,
    [sessionId, studentId],
  );
  return rows.map(toBooking);
}
