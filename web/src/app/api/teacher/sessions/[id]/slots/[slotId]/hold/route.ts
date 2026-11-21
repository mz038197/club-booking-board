import { parseHoldName, releaseHold, setHold } from "@/server/holds";
import { jsonBody, logAction, sessionRoute } from "@/server/http/teacher-route";

export const dynamic = "force-dynamic";

/**
 * 設定教師保留 `{ name? }`（空白 → 「保留」，20 字以內）→ 200 `{ slot_id, name }`；
 * 已借 → 409 CONFLICT，不存在 → 404 NOT_FOUND. 再設一次就改名字.
 */
export const PUT = sessionRoute<{ id: string; slotId: string }>(async (args) => {
  const { req, deps, session, params } = args;
  const name = parseHoldName(await jsonBody(req));
  const shown = await setHold(deps.db, { sessionId: session.id, slotId: params.slotId, name, now: deps.now() });
  await logAction(args, session.id, "setHold", `設定保留 ${params.slotId}（${shown}）`);
  return Response.json({ slot_id: params.slotId, name: shown });
});

/** 解除保留 → 204；沒有保留 → 404 NOT_FOUND. */
export const DELETE = sessionRoute<{ id: string; slotId: string }>(async (args) => {
  const { deps, session, params } = args;
  await releaseHold(deps.db, { sessionId: session.id, slotId: params.slotId });
  await logAction(args, session.id, "releaseHold", `解除保留 ${params.slotId}`);
  return new Response(null, { status: 204 });
});
