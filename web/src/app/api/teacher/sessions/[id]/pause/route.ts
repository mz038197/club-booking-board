import { ApiError } from "@/server/http/errors";
import { jsonBody, logAction, sessionRoute } from "@/server/http/teacher-route";
import { setPaused } from "@/server/sessions";

export const dynamic = "force-dynamic";

/** 暫停／恢復：`{ paused: boolean }`. 暫停只擋學生的預約與取消，查詢照常. */
export const PUT = sessionRoute(async (args) => {
  const { req, deps, session } = args;
  const { paused } = await jsonBody(req);
  if (typeof paused !== "boolean") {
    throw new ApiError(400, "INVALID_REQUEST", "請求內容必須是 { \"paused\": true | false }");
  }
  await setPaused(deps.db, session.id, paused);
  await logAction(
    args,
    session.id,
    "setPaused",
    paused ? "已暫停預約：學生 Agent 預約／取消會收到 403 BOOKING_CLOSED，查詢照常" : "已恢復預約",
  );
  return Response.json({ paused });
});
