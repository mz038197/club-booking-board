import { cookies } from "next/headers";
import { Landing } from "@/components/landing/Landing";
import { getDeps } from "@/server/deps";
import { readTeacherSession, TEACHER_COOKIE } from "@/server/http/teacher-auth";
import { loginErrorParam } from "@/app/login-paths";

export const dynamic = "force-dynamic";

/** 首頁: the landing. Reads only the signed session cookie, no router call. */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const deps = await getDeps();
  const teacher = readTeacherSession((await cookies()).get(TEACHER_COOKIE)?.value, deps.sessionSecret, deps.now());
  return (
    <Landing
      teacherName={teacher?.displayName ?? null}
      error={loginErrorParam(params.error)}
      loginRequired={params.notice === "login_required"}
    />
  );
}
