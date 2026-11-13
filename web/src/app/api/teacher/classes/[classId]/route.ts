import { getDeps } from "@/server/deps";
import { handle } from "@/server/http/errors";
import { parseClassId, requireClassAccess, requireTeacher } from "@/server/http/teacher-auth";

export const dynamic = "force-dynamic";

/** One 班級 the teacher may manage; 403 FORBIDDEN otherwise. */
export const GET = handle(
  async (req: Request, ctx: { params: Promise<{ classId: string }> }) => {
    const deps = await getDeps();
    const access = await requireTeacher(req, deps);
    const cls = requireClassAccess(access, parseClassId((await ctx.params).classId));
    return Response.json({ class: cls });
  },
);
