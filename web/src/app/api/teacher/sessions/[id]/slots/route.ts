import { jsonBody, logAction, sessionRoute } from "@/server/http/teacher-route";
import { boardOf } from "@/server/sessions";
import { parseSlotList, replaceSlots } from "@/server/slot-list";

export const dynamic = "force-dynamic";

/** 整批覆寫可借清單 `{ slots: [{date,start,end,room}] }`；會丟掉已借格 → 409 CONFLICT，不寫入. */
export const PUT = sessionRoute(async (args) => {
  const { req, deps, session } = args;
  const slots = parseSlotList(await jsonBody(req));
  await replaceSlots(deps.db, session.id, slots);
  const board = await boardOf(deps.db, session.id);
  await logAction(args, session.id, "replaceSlots", `整批覆寫可借清單（現在 ${board.length} 格）`);
  return Response.json({ slots: board });
});
