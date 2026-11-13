import { getDeps } from "@/server/deps";
import { handle } from "@/server/http/errors";
import { requireCurrentSession, requireStudent } from "@/server/http/student-auth";
import { boardOf } from "@/server/sessions";

export const dynamic = "force-dynamic";

/** listSlots: 列出目前堂課的可借格（含已借者顯示名稱）. */
export const GET = handle(async (req: Request) => {
  const deps = await getDeps();
  const student = await requireStudent(req, deps);
  const session = await requireCurrentSession(student, deps);
  const slots = await boardOf(deps.db, session.id);
  return Response.json({ session: { id: session.id, name: session.name }, slots });
});
