import { logAction, sessionRoute } from "@/server/http/teacher-route";
import { resetSession } from "@/server/live";

export const dynamic = "force-dynamic";

/**
 * 重置堂課（UI 做二段確認）→ 204：清空預約與 API 呼叫紀錄；
 * 保留可借清單、預約規則、名冊與教師操作紀錄.
 */
export const POST = sessionRoute(async (args) => {
  const { deps, session } = args;
  await resetSession(deps.db, session.id);
  await logAction(args, session.id, "resetSession", "重置堂課：清空全部預約與 API 呼叫紀錄（可借清單、規則、名冊保留）");
  return new Response(null, { status: 204 });
});
