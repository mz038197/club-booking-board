import type { Deps } from "../deps";
import { currentSessionOf, type Session } from "../sessions";
import type { Student } from "../router-gateway";
import { ApiError } from "./errors";

export const NO_SESSION_NOTICE = "你的班級尚無堂課，請等老師建立堂課後再試";
export const ROUTER_UNAVAILABLE_NOTICE = "身分驗證服務暫時無法使用，請稍後再試";

function bearerKey(req: Request): string | null {
  const header = req.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Who is calling: checks the `Authorization: Bearer <課堂金鑰>` with the
 * router gateway. Throws 401 UNAUTHORIZED / 403 NOT_A_STUDENT / 503 ROUTER_UNAVAILABLE.
 */
export async function requireStudent(req: Request, deps: Deps): Promise<Student> {
  const check = await deps.gateway.checkStudentKey(bearerKey(req));
  if (check.ok) return check.student;
  switch (check.reason) {
    case "unavailable":
      throw new ApiError(503, "ROUTER_UNAVAILABLE", ROUTER_UNAVAILABLE_NOTICE);
    case "not_a_student":
      throw new ApiError(403, "NOT_A_STUDENT", check.message);
    default:
      throw new ApiError(401, "UNAUTHORIZED", check.message);
  }
}

/** The student's class's 目前堂課; 403 BOOKING_CLOSED when the class has none. */
export async function requireCurrentSession(student: Student, deps: Deps): Promise<Session> {
  const session = await currentSessionOf(deps.db, student.classId);
  if (!session) throw new ApiError(403, "BOOKING_CLOSED", NO_SESSION_NOTICE);
  return session;
}
