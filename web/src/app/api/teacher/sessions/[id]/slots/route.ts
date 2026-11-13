import { jsonBody, sessionRoute } from "@/server/http/teacher-route";
import { boardOf } from "@/server/sessions";
import { parseSlotList, replaceSlots } from "@/server/slot-list";

export const dynamic = "force-dynamic";

/** 整批覆寫可借清單 `{ slots: [{date,start,end,room}] }`；會丟掉已借格 → 409 CONFLICT，不寫入. */
export const PUT = sessionRoute(async ({ req, deps, session }) => {
  const slots = parseSlotList(await jsonBody(req));
  await replaceSlots(deps.db, session.id, slots);
  return Response.json({ slots: await boardOf(deps.db, session.id) });
});
