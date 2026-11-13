import { ApiError } from "@/server/http/errors";
import { jsonBody, sessionRoute } from "@/server/http/teacher-route";
import { setPaused } from "@/server/sessions";

export const dynamic = "force-dynamic";

/** 暫停／恢復：`{ paused: boolean }`. 暫停只擋學生的預約與取消，查詢照常. */
export const PUT = sessionRoute(async ({ req, deps, session }) => {
  const { paused } = await jsonBody(req);
  if (typeof paused !== "boolean") {
    throw new ApiError(400, "INVALID_REQUEST", "請求內容必須是 { \"paused\": true | false }");
  }
  await setPaused(deps.db, session.id, paused);
  // 教師操作紀錄 (#20): log 「已暫停預約」/「已恢復預約」 here.
  return Response.json({ paused });
});
