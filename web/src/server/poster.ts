import { ApiError } from "./http/errors";

/** 海報文案 input (v1 `PosterCopyRequest`). */
export type PosterRequest = { title: string; time: string; place: string; notes: string | null };
/** 海報文案 output (v1 `PosterCopyResponse`): text only, never an image. */
export type PosterCopy = { title: string; time_place: string; slogan: string; body: string };

const INVALID = "海報資料不完整：title、time、place 必須是非空字串，notes 可省略";

/** Validates a parsed JSON body; anything else (including a non-JSON body → null) → 400 INVALID_POSTER. */
export function parsePosterRequest(body: unknown): PosterRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "INVALID_POSTER", INVALID);
  }
  const { title, time, place, notes } = body as Record<string, unknown>;
  const filled = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
  if (!filled(title) || !filled(time) || !filled(place)) throw new ApiError(400, "INVALID_POSTER", INVALID);
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    throw new ApiError(400, "INVALID_POSTER", INVALID);
  }
  return { title, time, place, notes: notes ?? null };
}

/** Deterministic template, same wording as v1 `/poster/copy`. */
export function writePosterCopy({ title, time, place, notes }: PosterRequest): PosterCopy {
  const extra = notes?.trim() ? `備註：${notes.trim()}` : "";
  return {
    title,
    time_place: `${time} @ ${place}`,
    slogan: `一起來！${title}`,
    body: `歡迎參加「${title}」！時間地點：${time}，${place}。${extra}`,
  };
}
