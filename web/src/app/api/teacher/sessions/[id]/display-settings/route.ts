import { ApiError } from "@/server/http/errors";
import { jsonBody, logAction, sessionRoute } from "@/server/http/teacher-route";
import { setDisplaySettings } from "@/server/monitor";

export const dynamic = "force-dynamic";

const INVALID = "請送出 JSON：{ mask_names?: boolean, auto_follow?: boolean }，至少一項";

/** 投影顯示設定: 遮蔽名稱 / 自動跳日 of one 堂課. Body fields are optional; at least one. */
export const PATCH = sessionRoute(async (args) => {
  const { req, deps, session } = args;
  const { mask_names, auto_follow } = await jsonBody(req).catch(() => {
    throw new ApiError(400, "INVALID_REQUEST", INVALID);
  });
  const ok = (v: unknown): v is boolean | undefined => v === undefined || typeof v === "boolean";
  if (!ok(mask_names) || !ok(auto_follow) || (mask_names === undefined && auto_follow === undefined)) {
    throw new ApiError(400, "INVALID_REQUEST", INVALID);
  }
  const updated = await setDisplaySettings(deps.db, session.id, {
    maskNames: mask_names,
    autoFollow: auto_follow,
  });
  await logAction(
    args,
    session.id,
    "displaySettings",
    `投影：${updated.maskNames ? "遮蔽名稱" : "顯示名稱"}、${updated.autoFollow ? "自動跳日" : "不自動跳日"}`,
  );
  return Response.json({
    settings: { mask_names: updated.maskNames, auto_follow: updated.autoFollow },
  });
});
