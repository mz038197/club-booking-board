import type { Db } from "./db";
import { ApiError } from "./http/errors";

/**
 * 海報 data access. A 海報 belongs to one 預約 (one each; 再貼 overwrites) and goes
 * away with it. Only 活動名稱 and 內文 are the student's; 日期、時段、教室 always
 * come from the 預約's 可借格.
 */

/** What the student's Agent sends (`WritePosterRequest`). */
export type PosterInput = { title: string; body: string };

/** A 海報 as write_poster answers it (`Poster`). */
export type Poster = PosterInput & {
  booking_id: string;
  date: string;
  start: string;
  end: string;
  room: string;
};

/**
 * The one place a 海報 is checked before it is saved: a parsed JSON body (non-JSON → null)
 * must be `{ title: string, body: string }`, else 400 INVALID_REQUEST.
 */
export function parsePoster(body: unknown): PosterInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "INVALID_REQUEST", "請求內容必須是 JSON，包含文字欄位 title 與 body");
  }
  const { title, body: text } = body as Record<string, unknown>;
  if (typeof title !== "string" || typeof text !== "string") {
    throw new ApiError(400, "INVALID_REQUEST", "請求內容必須包含文字欄位 title（活動名稱）與 body（內文）");
  }
  return { title, body: text };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pins a 海報 on a student's own 預約 in a 堂課, replacing any earlier one.
 * Throws 404 NOT_FOUND (no such 預約 in this 堂課) / 403 NOT_OWNER.
 */
export async function writePoster(
  db: Db,
  input: {
    sessionId: string;
    bookingId: string;
    studentId: number;
    poster: PosterInput;
    now: Date;
    /** Called with the 預約's slot_id once found (before the owner check). */
    onFound?: (slotId: string) => void;
  },
): Promise<Poster> {
  const notFound = new ApiError(404, "NOT_FOUND", "找不到這筆預約");
  if (!UUID.test(input.bookingId)) throw notFound;
  return db.transaction(async (tx) => {
    // FOR SHARE: a concurrent 取消 waits for the 海報 (then deletes it with the 預約) or goes first (we see no 預約).
    const [booking] = await tx.query<{
      slot_id: string;
      student_id: number;
      date: string;
      start_time: string;
      end_time: string;
      room: string;
    }>(
      `SELECT b.slot_id, b.student_id, s.date, s.start_time, s.end_time, s.room
         FROM bookings b
         JOIN slots s ON s.session_id = b.session_id AND s.slot_id = b.slot_id
        WHERE b.id = $1 AND b.session_id = $2
          FOR SHARE OF b`,
      [input.bookingId, input.sessionId],
    );
    if (!booking) throw notFound;
    input.onFound?.(booking.slot_id);
    if (booking.student_id !== input.studentId) {
      throw new ApiError(403, "NOT_OWNER", "只能替自己的預約貼海報");
    }
    await tx.query(
      `INSERT INTO posters (booking_id, title, body, updated_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (booking_id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, updated_at = EXCLUDED.updated_at`,
      [input.bookingId, input.poster.title, input.poster.body, input.now],
    );
    return {
      booking_id: input.bookingId,
      title: input.poster.title,
      body: input.poster.body,
      date: booking.date,
      start: booking.start_time,
      end: booking.end_time,
      room: booking.room,
    };
  });
}

/**
 * 老師刪除海報: removes the 海報 of the 預約 on a 可借格; the 預約 itself stays.
 * Returns who had posted it and its 活動名稱, for the 教師操作紀錄.
 * Throws 404 NOT_FOUND when the 可借格 has no 海報.
 */
export async function deletePosterOfSlot(
  db: Db,
  input: { sessionId: string; slotId: string },
): Promise<{ displayName: string; title: string }> {
  const [removed] = await db.query<{ title: string; display_name: string | null }>(
    `DELETE FROM posters p
      USING bookings b LEFT JOIN students st ON st.student_id = b.student_id
      WHERE p.booking_id = b.id AND b.session_id = $1 AND b.slot_id = $2
      RETURNING p.title, st.display_name`,
    [input.sessionId, input.slotId],
  );
  if (!removed) throw new ApiError(404, "NOT_FOUND", "這個可借格沒有海報");
  return { displayName: removed.display_name ?? "", title: removed.title };
}
