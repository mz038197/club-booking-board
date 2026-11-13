import { studentRoute } from "@/server/http/student-route";
import { boardOf } from "@/server/sessions";

export const dynamic = "force-dynamic";

/** listSlots: 列出目前堂課的可借格（含已借者顯示名稱）. */
export const GET = studentRoute("listSlots", async ({ deps, session }) => {
  const slots = await boardOf(deps.db, session.id);
  return Response.json({ session: { id: session.id, name: session.name }, slots });
});
