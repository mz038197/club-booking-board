import { sessionRoute } from "@/server/http/teacher-route";
import { removeSlot } from "@/server/slot-list";

export const dynamic = "force-dynamic";

/** 移除單格；已借 → 409 CONFLICT，不存在 → 404 NOT_FOUND. */
export const DELETE = sessionRoute<{ id: string; slotId: string }>(async ({ deps, session, params }) => {
  await removeSlot(deps.db, session.id, params.slotId);
  return new Response(null, { status: 204 });
});
