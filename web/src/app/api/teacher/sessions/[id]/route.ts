import { sessionRoute } from "@/server/http/teacher-route";
import { boardOf, currentSessionOf } from "@/server/sessions";

export const dynamic = "force-dynamic";

/** 一個堂課：設定與看板（可借清單＋預約狀態、已借者顯示名稱）. */
export const GET = sessionRoute(async ({ deps, session }) => {
  const [current, slots] = await Promise.all([
    currentSessionOf(deps.db, session.classId),
    boardOf(deps.db, session.id),
  ]);
  return Response.json({
    session: {
      id: session.id,
      class_id: session.classId,
      name: session.name,
      is_current: current?.id === session.id,
      paused: session.paused,
      per_student_limit: session.perStudentLimit,
    },
    slots,
  });
});
