import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDeps } from "./deps";
import { ApiError } from "./http/errors";
import { TEACHER_COOKIE, teacherAccess, type TeacherAccess } from "./http/teacher-auth";

/**
 * For teacher pages (server components): the signed-in teacher's access, or a
 * redirect to /login when the cookie is missing, forged or expired.
 */
export async function requireTeacherPage(): Promise<TeacherAccess> {
  const deps = await getDeps();
  const value = (await cookies()).get(TEACHER_COOKIE)?.value;
  let access: TeacherAccess | null;
  try {
    access = await teacherAccess(value, deps);
  } catch (error) {
    if (error instanceof ApiError && error.code === "ROUTER_UNAVAILABLE") {
      redirect("/login?error=router_unavailable");
    }
    throw error;
  }
  if (!access) redirect("/login");
  return access;
}
