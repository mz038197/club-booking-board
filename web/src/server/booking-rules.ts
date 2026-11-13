import { ApiError } from "./http/errors";
import type { BookingWindow, Session } from "./sessions";

/**
 * 預約規則 and 暫停 as applied to a student's 預約 / 取消 (ADR 0004).
 * Queries are never blocked here. 每人上限 is enforced inside `bookSlot`'s transaction.
 */

/** 時間窗 times are wall-clock times of the school, Asia/Taipei. */
export const CLASS_TIME_ZONE = "Asia/Taipei";

export const PAUSED_NOTICE = "老師已暫停預約與取消，請稍後再試；查詢可借格不受影響";

const hhmm = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLASS_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The time of day at `now` in the school's time zone, as HH:MM. */
export function classTimeOfDay(now: Date): string {
  return hhmm.format(now);
}

const windowText = (w: BookingWindow) => `上課當天 ${w.start}–${w.end}`;

/** 403 BOOKING_CLOSED when the 堂課 is 暫停 or `now` is outside its 時間窗. */
export function assertBookingOpen(session: Session, now: Date): void {
  if (session.paused) throw new ApiError(403, "BOOKING_CLOSED", PAUSED_NOTICE);
  const w = session.bookingWindow;
  if (!w) return;
  const t = classTimeOfDay(now);
  if (t < w.start) {
    throw new ApiError(
      403,
      "BOOKING_CLOSED",
      `預約與取消尚未開放，${w.start} 開放（可預約時間：${windowText(w)}）`,
    );
  }
  if (t >= w.end) {
    throw new ApiError(
      403,
      "BOOKING_CLOSED",
      `今天的預約與取消已於 ${w.end} 結束（可預約時間：${windowText(w)}）`,
    );
  }
}

export const limitReachedMessage = (limit: number) =>
  `你已經預約了 ${limit} 格（每人最多 ${limit} 格），請先取消一格再預約`;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const bad = (message: string) => new ApiError(400, "INVALID_REQUEST", message);

/**
 * Validates `{ per_student_limit: 1–5, booking_window: {start, end} | null }`;
 * 400 INVALID_REQUEST otherwise.
 */
export function parseBookingRules(body: Record<string, unknown>): {
  perStudentLimit: number;
  bookingWindow: BookingWindow | null;
} {
  const limit = body.per_student_limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 5) {
    throw bad("每人上限必須是 1 到 5 的整數");
  }
  const w = body.booking_window;
  if (w === null || w === undefined) return { perStudentLimit: limit, bookingWindow: null };
  const { start, end } = (typeof w === "object" ? w : {}) as { start?: unknown; end?: unknown };
  if (typeof start !== "string" || typeof end !== "string" || !TIME.test(start) || !TIME.test(end)) {
    throw bad("可預約時間必須是 HH:MM，例如 12:30");
  }
  if (start >= end) throw bad(`可預約時間 ${start}–${end} 的開始必須早於結束`);
  return { perStudentLimit: limit, bookingWindow: { start, end } };
}
