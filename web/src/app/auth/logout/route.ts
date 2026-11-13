import { handle } from "@/server/http/errors";
import { clearedTeacherSessionCookie } from "@/server/http/teacher-auth";
import { HOME_PATH } from "@/app/login-paths";

export const dynamic = "force-dynamic";

/** 登出: clears the session cookie (POST from the admin header's form). */
export const POST = handle(async (req: Request) => {
  const headers = new Headers({ location: new URL(HOME_PATH, req.url).toString() });
  headers.append("set-cookie", clearedTeacherSessionCookie());
  return new Response(null, { status: 303, headers });
});
