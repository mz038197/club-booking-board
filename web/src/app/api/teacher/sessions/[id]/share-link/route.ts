import { ApiError } from "@/server/http/errors";
import { logAction, sessionRoute } from "@/server/http/teacher-route";
import { currentSessionOf } from "@/server/sessions";
import { closeShareLink, createShareLink, SHARE_LINK_HOURS, shareLinkOf } from "@/server/share-links";

export const dynamic = "force-dynamic";

/** 學生分享連結 of a 堂課: its status (the token itself is never readable again). */
export const GET = sessionRoute(async ({ deps, session }) => {
  const link = await shareLinkOf(deps.db, session.id, deps.now());
  return Response.json({
    share_link: link
      ? { created_at: link.createdAt.toISOString(), expires_at: link.expiresAt.toISOString() }
      : null,
  });
});

/**
 * Makes (or remakes) the 目前堂課's 分享連結; the previous link stops working at once.
 * The token is in this response only.
 */
export const POST = sessionRoute(async (args) => {
  const { req, deps, session } = args;
  const current = await currentSessionOf(deps.db, session.classId);
  if (current?.id !== session.id) {
    throw new ApiError(409, "CONFLICT", "只能為目前堂課產生分享連結");
  }
  const had = (await shareLinkOf(deps.db, session.id, deps.now())) !== null;
  const link = await createShareLink(deps.db, session.id, deps.now());
  await logAction(
    args,
    session.id,
    "shareLink",
    had ? "已重新產生分享連結：舊連結立即失效" : `已產生分享連結（${SHARE_LINK_HOURS} 小時後失效）`,
  );
  return Response.json(
    {
      share_link: {
        token: link.token,
        url: new URL(`/share/${link.token}`, req.url).toString(),
        created_at: link.createdAt.toISOString(),
        expires_at: link.expiresAt.toISOString(),
      },
    },
    { status: 201 },
  );
});

/** 關閉分享: the link stops working at once. */
export const DELETE = sessionRoute(async (args) => {
  const { deps, session } = args;
  await closeShareLink(deps.db, session.id);
  await logAction(args, session.id, "shareLink", "已關閉分享連結");
  return new Response(null, { status: 204 });
});
