import { parseBookingRules } from "@/server/booking-rules";
import { jsonBody, logAction, sessionRoute } from "@/server/http/teacher-route";
import { setBookingRules } from "@/server/sessions";

export const dynamic = "force-dynamic";

/**
 * 預約規則：`{ per_student_limit: 1–5 }`.
 * Answers the saved rules.
 */
export const PUT = sessionRoute(async (args) => {
  const { req, deps, session } = args;
  const rules = parseBookingRules(await jsonBody(req));
  await setBookingRules(deps.db, session.id, rules);
  await logAction(args, session.id, "setRules", `規則：每人最多 ${rules.perStudentLimit} 格`);
  return Response.json({ per_student_limit: rules.perStudentLimit });
});
