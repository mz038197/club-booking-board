import type { BoardSnapshot } from "@/board/snapshot";
import { getDeps } from "@/server/deps";
import { ApiError, handle } from "@/server/http/errors";
import { boardOf } from "@/server/sessions";
import { SHARE_LINK_GONE, sessionOfShareToken } from "@/server/share-links";

export const dynamic = "force-dynamic";

/**
 * 學生分享連結 (ADR 0005), no login: the read-only 看板 of the link's 堂課 with full
 * 顯示名稱 (never masked). There is no write endpoint under /api/share.
 */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ token: string }> }) => {
  const deps = await getDeps();
  const session = await sessionOfShareToken(deps.db, (await ctx.params).token, deps.now());
  if (!session) throw new ApiError(404, "NOT_FOUND", SHARE_LINK_GONE);
  const snapshot: BoardSnapshot = {
    session: { id: session.id, name: session.name },
    slots: await boardOf(deps.db, session.id),
  };
  return Response.json(snapshot, { headers: { "cache-control": "no-store" } });
});
