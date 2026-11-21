import type { BoardSnapshot } from "@/board/snapshot";
import { getDeps } from "@/server/deps";
import { ApiError, handle } from "@/server/http/errors";
import { boardOf } from "@/server/sessions";
import { SHARE_LINK_GONE, sessionOfShareToken } from "@/server/share-links";

export const dynamic = "force-dynamic";

/**
 * 學生分享連結 (ADR 0005), no login: the read-only 看板 of the link's 堂課 with full
 * 顯示名稱 (never masked) and each 預約's 海報. There is no write endpoint under /api/share.
 */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ token: string }> }) => {
  const deps = await getDeps();
  const session = await sessionOfShareToken(deps.db, (await ctx.params).token, deps.now());
  if (!session) throw new ApiError(404, "NOT_FOUND", SHARE_LINK_GONE);
  const snapshot: BoardSnapshot = {
    session: { id: session.id, name: session.name },
    // 海報 yes; 教師保留 stays a plain 已借 (no teacherView, ADR 0006).
    slots: await boardOf(deps.db, session.id, { withPosters: true }),
  };
  return Response.json(snapshot, { headers: { "cache-control": "no-store" } });
});
