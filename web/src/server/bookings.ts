import type { Db } from "./db";
import { ApiError } from "./http/errors";
import { recordFirstBooking } from "./students";

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
 * Throws 400 INVALID_SLOT (not a 可借格 of this 堂課) / 409 SLOT_TAKEN.
 */
export async function bookSlot(
  db: Db,
  input: { sessionId: string; slotId: string; studentId: number; now: Date },
): Promise<Booking> {
  return db.transaction(async (tx) => {
    const [slot] = await tx.query<{ date: string; start_time: string; end_time: string; room: string }>(
      `SELECT date, start_time, end_time, room FROM slots WHERE session_id = $1 AND slot_id = $2`,
      [input.sessionId, input.slotId],
    );
    if (!slot) throw new ApiError(400, "INVALID_SLOT", "此堂課沒有這個可借格");
    const [row] = await tx.query<{ id: string; created_at: Date | string }>(
      `INSERT INTO bookings (session_id, slot_id, student_id, created_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, slot_id) DO NOTHING
       RETURNING id, created_at`,
      [input.sessionId, input.slotId, input.studentId, input.now],
    );
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

/** A 預約 as the teacher sees it: with the student and their latest 顯示名稱. */
export type SessionBooking = Booking & { student_id: number; display_name: string };

/** Every 預約 of a 堂課, in board order. */
export async function sessionBookingsOf(db: Db, sessionId: string): Promise<SessionBooking[]> {
  const rows = await db.query<BookingRow & { student_id: number; display_name: string }>(
    `SELECT b.id, b.slot_id, s.date, s.start_time, s.end_time, s.room, b.created_at,
            b.student_id, st.display_name
       FROM bookings b
       JOIN slots s ON s.session_id = b.session_id AND s.slot_id = b.slot_id
       JOIN students st ON st.student_id = b.student_id
      WHERE b.session_id = $1
      ORDER BY s.date, s.start_time, s.room`,
    [sessionId],
  );
  return rows.map((r) => ({ ...toBooking(r), student_id: r.student_id, display_name: r.display_name }));
}

/**
 * 強制取消: the teacher deletes any 預約 of the 堂課 (no owner check).
 * Returns what was cancelled; throws 404 NOT_FOUND (no such 預約 in this 堂課).
 */
export async function forceCancelBooking(
  db: Db,
  input: { sessionId: string; bookingId: string },
): Promise<{ slotId: string; studentId: number; displayName: string }> {
  if (!UUID.test(input.bookingId)) throw new ApiError(404, "NOT_FOUND", "找不到這筆預約");
  const [row] = await db.query<{ slot_id: string; student_id: number; display_name: string }>(
    `DELETE FROM bookings b USING students st
      WHERE b.id = $1 AND b.session_id = $2 AND st.student_id = b.student_id
      RETURNING b.slot_id, b.student_id, st.display_name`,
    [input.bookingId, input.sessionId],
  );
  if (!row) throw new ApiError(404, "NOT_FOUND", "找不到這筆預約");
  return { slotId: row.slot_id, studentId: row.student_id, displayName: row.display_name };
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
