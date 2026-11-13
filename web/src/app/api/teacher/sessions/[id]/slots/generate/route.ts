import { jsonBody, sessionRoute } from "@/server/http/teacher-route";
import { generateSlots, parseSlotGrid } from "@/server/slot-list";

export const dynamic = "force-dynamic";

/**
 * 批次產生可借格 `{ dates, times: [{start,end}], rooms, preview? }`（日期 × 時段 × 教室，略過重複）.
 * `preview: true` 只回格數不寫入. → `{ requested, added, skipped }`
 */
export const POST = sessionRoute(async ({ req, deps, session }) => {
  const body = await jsonBody(req);
  const result = await generateSlots(deps.db, session.id, parseSlotGrid(body), {
    preview: body.preview === true,
  });
  return Response.json(result);
});
