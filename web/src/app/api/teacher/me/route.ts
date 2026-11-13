import { getDeps } from "@/server/deps";
import { handle } from "@/server/http/errors";
import { requireTeacher } from "@/server/http/teacher-auth";

export const dynamic = "force-dynamic";

/** The signed-in teacher and the 班級 they may manage (from the router, cached 60 s). */
export const GET = handle(async (req: Request) => {
  const access = await requireTeacher(req, await getDeps());
  return Response.json({
    teacher: { user_id: access.teacher.userId, display_name: access.teacher.displayName },
    is_admin: access.isAdmin,
    classes: access.classes,
  });
});
