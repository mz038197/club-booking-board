import { parseBookingRules } from "@/server/booking-rules";
import { jsonBody, sessionRoute } from "@/server/http/teacher-route";
import { setBookingRules } from "@/server/sessions";

export const dynamic = "force-dynamic";

/**
 * 預約規則：`{ per_student_limit: 1–5, booking_window: { start, end } | null }`（時間窗為上課當天 HH:MM，Asia/Taipei）.
 * Answers the saved rules.
 */
export const PUT = sessionRoute(async ({ req, deps, session }) => {
  const rules = parseBookingRules(await jsonBody(req));
  await setBookingRules(deps.db, session.id, rules);
  // 教師操作紀錄 (#20): log 「規則：每人最多 N 格，start–end 可預約」 here.
  return Response.json({ per_student_limit: rules.perStudentLimit, booking_window: rules.bookingWindow });
});
