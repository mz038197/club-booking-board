import type { ClassRef } from "../router-gateway";
import { getDeps, type Deps } from "../deps";
import { sessionById, type Session } from "../sessions";
import { ApiError, handle } from "./errors";
import { parseClassId, requireClassAccess, requireTeacher, type TeacherAccess } from "./teacher-auth";

/**
 * Teacher route wrappers. Every teacher endpoint keyed by a 班級 uses `classRoute`;
 * every endpoint keyed by a 堂課 (`/api/teacher/sessions/:id/...`) uses `sessionRoute`.
 * Both answer 401 without a login, 403 FORBIDDEN for a 班級 the teacher does not manage.
 */

type Ctx<P> = { params: Promise<P> };

export type ClassRouteArgs = { req: Request; deps: Deps; access: TeacherAccess; cls: ClassRef };
export type SessionRouteArgs<P> = {
  req: Request;
  deps: Deps;
  access: TeacherAccess;
  session: Session;
  params: P;
};

export function classRoute<P extends { classId: string }>(
  fn: (args: ClassRouteArgs, params: P) => Promise<Response>,
) {
  return handle(async (req: Request, ctx: Ctx<P>) => {
    const deps = await getDeps();
    const access = await requireTeacher(req, deps);
    const params = await ctx.params;
    const cls = requireClassAccess(access, parseClassId(params.classId));
    return fn({ req, deps, access, cls }, params);
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** Loads the 堂課 (404 NOT_FOUND when unknown), then checks its 班級 (403). */
export function sessionRoute<P extends { id: string }>(
  fn: (args: SessionRouteArgs<P>) => Promise<Response>,
) {
  return handle(async (req: Request, ctx: Ctx<P>) => {
    const deps = await getDeps();
    const access = await requireTeacher(req, deps);
    const params = await ctx.params;
    const session = isUuid(params.id) ? await sessionById(deps.db, params.id) : null;
    if (!session) throw new ApiError(404, "NOT_FOUND", "找不到這個堂課");
    requireClassAccess(access, session.classId);
    return fn({ req, deps, access, session, params });
  });
}

/** The JSON object body of a request; 400 INVALID_REQUEST when it is not one. */
export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "INVALID_REQUEST", "請求內容必須是 JSON 物件");
  }
  return body as Record<string, unknown>;
}
