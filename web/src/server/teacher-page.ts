import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDeps } from "./deps";
import { ApiError } from "./http/errors";
import { TEACHER_COOKIE, teacherAccess, type TeacherAccess } from "./http/teacher-auth";
import { LOGIN_REQUIRED_PATH, loginErrorPath } from "@/app/login-paths";

/**
 * For teacher pages (server components): the signed-in teacher's access, or a
 * redirect to the 首頁 when the cookie is missing, forged or expired.
 */
export async function requireTeacherPage(): Promise<TeacherAccess> {
  const deps = await getDeps();
  const value = (await cookies()).get(TEACHER_COOKIE)?.value;
  let access: TeacherAccess | null;
  try {
    access = await teacherAccess(value, deps);
  } catch (error) {
    if (error instanceof ApiError && error.code === "ROUTER_UNAVAILABLE") {
      redirect(loginErrorPath("router_unavailable"));
    }
    throw error;
  }
  if (!access) redirect(LOGIN_REQUIRED_PATH);
  return access;
}
