import { ApiError } from "./http/errors";
import type { Session } from "./sessions";

/**
 * 預約規則 and 暫停 as applied to a student's 預約 / 取消 / 貼海報 (ADR 0004).
 * Queries are never blocked here. 每人上限 is enforced inside `bookSlot`'s transaction.
 * When a student may act at all is bounded by their 課堂金鑰's validity (the router
 * refuses expired / not-yet-started keys before we get here); 暫停 is the only brake.
 */

export const PAUSED_NOTICE = "老師已暫停預約與取消，請稍後再試；查詢可借格不受影響";
export const POSTER_PAUSED_NOTICE = "老師已暫停，目前不能貼海報，請稍後再試；查詢可借格不受影響";

/** 403 BOOKING_CLOSED when the 堂課 is 暫停 (預約、取消、貼海報; `notice` says which). */
export function assertBookingOpen(session: Session, notice: string = PAUSED_NOTICE): void {
  if (session.paused) throw new ApiError(403, "BOOKING_CLOSED", notice);
}

export const limitReachedMessage = (limit: number) =>
  `你已經預約了 ${limit} 格（每人最多 ${limit} 格），請先取消一格再預約`;

/** Validates `{ per_student_limit: 1–5 }`; 400 INVALID_REQUEST otherwise. */
export function parseBookingRules(body: Record<string, unknown>): { perStudentLimit: number } {
  const limit = body.per_student_limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 5) {
    throw new ApiError(400, "INVALID_REQUEST", "每人上限必須是 1 到 5 的整數");
  }
  return { perStudentLimit: limit };
}
