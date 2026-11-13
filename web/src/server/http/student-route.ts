import { logApiCall, type StudentAction } from "../call-log";
import { getDeps, type Deps } from "../deps";
import type { Student } from "../router-gateway";
import type { Session } from "../sessions";
import { recordFirstCall, upsertStudent } from "../students";
import { ApiError, handle } from "./errors";
import { requireCurrentSession, requireStudent } from "./student-auth";

export type StudentCall = {
  req: Request;
  deps: Deps;
  student: Student;
  session: Session;
  /** Set as soon as the call's 可借格 is known, so the API 呼叫紀錄 shows it even on failure. */
  log: { slotId: string | null };
};

/**
 * Every student endpoint goes through this:
 * Key Check → upsert 學生 (顯示名稱) → 目前堂課 → first call on the 名冊 → `fn`,
 * then one API 呼叫紀錄 row with the outcome (failures too). Calls refused
 * before the 目前堂課 is known (bad key, no 堂課) are not logged.
 */
export function studentRoute<P = Record<string, string>>(
  action: StudentAction,
  fn: (call: StudentCall, params: P) => Promise<Response>,
): (req: Request, ctx: { params: Promise<P> }) => Promise<Response> {
  return handle(async (req: Request, ctx: { params: Promise<P> }) => {
    const deps = await getDeps();
    const student = await requireStudent(req, deps);
    const at = deps.now();
    await upsertStudent(deps.db, student, at);
    const session = await requireCurrentSession(student, deps);
    await recordFirstCall(deps.db, session.id, student.studentId, at);

    const call: StudentCall = { req, deps, student, session, log: { slotId: null } };
    const record = (status: number, code: string | null) =>
      logApiCall(deps.db, {
        sessionId: session.id,
        at,
        studentId: student.studentId,
        action,
        slotId: call.log.slotId,
        status,
        code,
      }).catch((error) => console.error("[api] could not write API 呼叫紀錄", error));

    let response: Response;
    try {
      response = await fn(call, await ctx.params);
    } catch (error) {
      if (error instanceof ApiError) await record(error.status, error.code);
      else await record(500, "INTERNAL_ERROR");
      throw error;
    }
    await record(response.status, null);
    return response;
  });
}
