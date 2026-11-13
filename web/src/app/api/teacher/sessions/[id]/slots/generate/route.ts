import { jsonBody, logAction, sessionRoute } from "@/server/http/teacher-route";
import { generateSlots, parseSlotGrid } from "@/server/slot-list";

export const dynamic = "force-dynamic";

/**
 * 批次產生可借格 `{ dates, times: [{start,end}], rooms, preview? }`（日期 × 時段 × 教室，略過重複）.
 * `preview: true` 只回格數不寫入. → `{ requested, added, skipped }`
 */
export const POST = sessionRoute(async (args) => {
  const { req, deps, session } = args;
  const body = await jsonBody(req);
  const preview = body.preview === true;
  const result = await generateSlots(deps.db, session.id, parseSlotGrid(body), { preview });
  if (!preview) {
    const skipped = result.skipped ? `（略過重複 ${result.skipped} 格）` : "";
    await logAction(args, session.id, "generateSlots", `新增 ${result.added} 格可借格${skipped}`);
  }
  return Response.json(result);
});
