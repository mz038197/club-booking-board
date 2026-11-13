import type { Deps } from "../deps";
import { monitorSessionOf, type MonitorSession } from "../monitor";
import { ApiError } from "./errors";
import { requireClassAccess, requireTeacher, type TeacherAccess } from "./teacher-auth";

export const SESSION_NOT_FOUND_NOTICE = "找不到這個堂課";

/**
 * For teacher routes keyed by a 堂課 id: signed-in teacher (401/503), the 堂課
 * (404 NOT_FOUND when unknown), then the 班級 check (403 FORBIDDEN).
 */
export async function requireTeacherSession(
  req: Request,
  deps: Deps,
  sessionId: string,
): Promise<{ access: TeacherAccess; session: MonitorSession }> {
  const access = await requireTeacher(req, deps);
  const session = await monitorSessionOf(deps.db, sessionId);
  if (!session) throw new ApiError(404, "NOT_FOUND", SESSION_NOT_FOUND_NOTICE);
  requireClassAccess(access, session.classId);
  return { access, session };
}
