import { getDeps } from "@/server/deps";
import { handle } from "@/server/http/errors";
import { startTeacherLogin } from "@/server/http/teacher-login";

export const dynamic = "force-dynamic";

/** 「用 Google 登入」 → router /oauth/authorize (client club-booking-admin, scope openid teacher, PKCE). */
export const GET = handle(async (req: Request) => startTeacherLogin(req, await getDeps()));
