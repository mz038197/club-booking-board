import { logAction, sessionRoute } from "@/server/http/teacher-route";
import { makeCurrentSession } from "@/server/sessions";

export const dynamic = "force-dynamic";

/** 設為目前堂課（例如切回舊堂課）：學生之後都進這個堂課. */
export const POST = sessionRoute(async (args) => {
  const { deps, session } = args;
  await makeCurrentSession(deps.db, session);
  await logAction(args, session.id, "makeCurrent", `設為目前堂課：學生的 Agent 之後都進「${session.name}」`);
  return Response.json({ current_session_id: session.id });
});
