import { TEACHER_COOKIE, signTeacherSession } from "@/server/http/teacher-auth";
import type { Teacher } from "@/server/router-gateway";
import type { TestApp } from "./app";

/**
 * A valid teacher session cookie for `app.request(..., { cookies })`, as the
 * login callback would set it. `issuedAt` defaults to the app clock.
 */
export function teacherCookie(
  app: TestApp,
  teacher: Teacher,
  issuedAt: Date = app.deps.now(),
): Record<string, string> {
  return { [TEACHER_COOKIE]: signTeacherSession(teacher, app.deps.sessionSecret, issuedAt) };
}

/** The `name=value` pairs a response sets, plus each cookie's full Set-Cookie line. */
export function setCookies(res: Response): Record<string, { value: string; line: string }> {
  const out: Record<string, { value: string; line: string }> = {};
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    out[pair.slice(0, eq).trim()] = { value: pair.slice(eq + 1), line };
  }
  return out;
}
