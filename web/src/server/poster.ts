import type { BoardPoster } from "@/board/types";
import type { Db } from "./db";
import { ApiError } from "./http/errors";
import { isUuid } from "./uuid";

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

/** 海報合格規則 (also spelled out to the Agent in the writePoster description). */
export const POSTER_BODY_MIN = 20;
export const POSTER_BODY_MAX = 500;
export const POSTER_BANNED_WORDS = ["保證錄取"] as const;

/**
 * 字數 = Unicode code points: a 中文字, a letter, a space or a punctuation mark counts 1; a simple
 * emoji counts 1, but a composite one (skin tone, ZWJ family, flag, variation selector) counts several.
 */
const countChars = (text: string) => [...text].length;

const invalidPoster = (rule: string) => new ApiError(400, "INVALID_POSTER", `海報不合格：${rule}`);

/**
 * The one place a 海報 is checked before it is saved: a parsed JSON body (non-JSON → null)
 * must be `{ title: string, body: string }`, else 400 INVALID_REQUEST. Both are trimmed, then
 * must pass the 海報合格規則, else 400 INVALID_POSTER naming the rule that failed.
 */
export function parsePoster(body: unknown): PosterInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "INVALID_REQUEST", "請求內容必須是 JSON，包含文字欄位 title 與 body");
  }
  const { title, body: text } = body as Record<string, unknown>;
  if (typeof title !== "string" || typeof text !== "string") {
    throw new ApiError(400, "INVALID_REQUEST", "請求內容必須包含文字欄位 title（活動名稱）與 body（內文）");
  }
  const poster = { title: title.trim(), body: text.trim() };
  if (poster.title === "") throw invalidPoster("活動名稱不能是空白");
  if (poster.body === "") throw invalidPoster("內文不能是空白");
  const length = countChars(poster.body);
  if (length < POSTER_BODY_MIN || length > POSTER_BODY_MAX) {
    throw invalidPoster(`內文要 ${POSTER_BODY_MIN}–${POSTER_BODY_MAX} 字，目前 ${length} 字`);
  }
  for (const word of POSTER_BANNED_WORDS) {
    if (poster.title.includes(word) || poster.body.includes(word)) {
      throw invalidPoster(`活動名稱與內文不能出現「${word}」`);
    }
  }
  return poster;
}

/** The `posters` columns a query selects as `p.title AS poster_title, p.body AS poster_body` (LEFT JOIN). */
export type PosterCols = { poster_title: string | null; poster_body: string | null };

/** The 海報 of a row selected with `PosterCols`; null when the 預約 has none. */
export const posterOf = (r: PosterCols): BoardPoster | null =>
  r.poster_title === null ? null : { title: r.poster_title, body: r.poster_body ?? "" };

/**
 * Pins a 海報 on a student's own 預約 in a 堂課, replacing any earlier one; returns it
 * with the 預約's slot_id (for the API 呼叫紀錄). The 預約 is checked before the 海報:
 * 404 NOT_FOUND (no such 預約 in this 堂課) / 403 NOT_OWNER come first, then `parsePoster`'s
 * 400 INVALID_REQUEST / INVALID_POSTER on the raw request `body`.
 */
export async function writePoster(
  db: Db,
  input: { sessionId: string; bookingId: string; studentId: number; body: unknown; now: Date },
): Promise<{ slotId: string; poster: Poster }> {
  const notFound = new ApiError(404, "NOT_FOUND", "找不到這筆預約");
  if (!isUuid(input.bookingId)) throw notFound;
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
    if (booking.student_id !== input.studentId) {
      throw new ApiError(403, "NOT_OWNER", "只能替自己的預約貼海報");
    }
    const poster = parsePoster(input.body);
    await tx.query(
      `INSERT INTO posters (booking_id, title, body, updated_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (booking_id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, updated_at = EXCLUDED.updated_at`,
      [input.bookingId, poster.title, poster.body, input.now],
    );
    return {
      slotId: booking.slot_id,
      poster: {
        booking_id: input.bookingId,
        title: poster.title,
        body: poster.body,
        date: booking.date,
        start: booking.start_time,
        end: booking.end_time,
        room: booking.room,
      },
    };
  });
}

/**
 * 教師刪除海報: removes the 海報 of the 預約 on a 可借格; the 預約 itself stays.
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
