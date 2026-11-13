import { getDeps } from "@/server/deps";
import { ApiError, handle } from "@/server/http/errors";
import { requireTeacherSession } from "@/server/http/teacher-session";
import { setDisplaySettings } from "@/server/monitor";

export const dynamic = "force-dynamic";

const INVALID = "請送出 JSON：{ mask_names?: boolean, auto_follow?: boolean }，至少一項";

/** 投影顯示設定: 遮蔽名稱 / 自動跳日 of one 堂課. Body fields are optional; at least one. */
export const PATCH = handle(
  async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
    const deps = await getDeps();
    const { session } = await requireTeacherSession(req, deps, (await ctx.params).sessionId);
    const change = parseChange(await req.text());
    const updated = await setDisplaySettings(deps.db, session.id, change);
    return Response.json({
      settings: { mask_names: updated.maskNames, auto_follow: updated.autoFollow },
    });
  },
);

function parseChange(text: string): { maskNames?: boolean; autoFollow?: boolean } {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_REQUEST", INVALID);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "INVALID_REQUEST", INVALID);
  }
  const { mask_names, auto_follow } = body as Record<string, unknown>;
  const ok = (v: unknown) => v === undefined || typeof v === "boolean";
  if (!ok(mask_names) || !ok(auto_follow) || (mask_names === undefined && auto_follow === undefined)) {
    throw new ApiError(400, "INVALID_REQUEST", INVALID);
  }
  return { maskNames: mask_names as boolean | undefined, autoFollow: auto_follow as boolean | undefined };
}
