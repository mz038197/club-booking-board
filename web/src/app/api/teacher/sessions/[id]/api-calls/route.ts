import { apiCallsOf } from "@/server/call-log";
import { sessionRoute } from "@/server/http/teacher-route";

export const dynamic = "force-dynamic";

/** API 呼叫紀錄（舊到新，含失敗），顯示名稱為學生最新的名稱. */
export const GET = sessionRoute(async ({ deps, session }) => {
  const calls = await apiCallsOf(deps.db, session.id);
  return Response.json({
    calls: calls.map((c) => ({
      at: c.at,
      student_id: c.studentId,
      display_name: c.displayName,
      action: c.action,
      slot_id: c.slotId,
      status: c.status,
      code: c.code,
    })),
  });
});
