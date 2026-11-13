import { getDeps } from "@/server/deps";
import { handle } from "@/server/http/errors";
import { finishTeacherLogin } from "@/server/http/teacher-login";

export const dynamic = "force-dynamic";

/** The router redirects here with `code` and `state`; sets the teacher session cookie. */
export const GET = handle(async (req: Request) => finishTeacherLogin(req, await getDeps()));
