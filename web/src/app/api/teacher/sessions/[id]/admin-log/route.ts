import { adminLogOf } from "@/server/admin-log";
import { sessionRoute } from "@/server/http/teacher-route";

export const dynamic = "force-dynamic";

/** 教師操作紀錄（新到舊）. */
export const GET = sessionRoute(async ({ deps, session }) => {
  const entries = await adminLogOf(deps.db, session.id);
  return Response.json({
    entries: entries.map((e) => ({
      at: e.at,
      teacher: { user_id: e.teacher.userId, display_name: e.teacher.displayName },
      action: e.action,
      message: e.message,
    })),
  });
});
