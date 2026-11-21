import { logAction, sessionRoute } from "@/server/http/teacher-route";
import { deletePosterOfSlot } from "@/server/poster";

export const dynamic = "force-dynamic";

/** 老師刪除海報（日展開）→ 204，預約不受影響；這一格沒有海報 → 404 NOT_FOUND. */
export const DELETE = sessionRoute<{ id: string; slotId: string }>(async (args) => {
  const { deps, session, params } = args;
  const removed = await deletePosterOfSlot(deps.db, { sessionId: session.id, slotId: params.slotId });
  await logAction(
    args,
    session.id,
    "deletePoster",
    `刪除 ${removed.displayName} 在 ${params.slotId} 的海報「${removed.title}」`,
  );
  return new Response(null, { status: 204 });
});
