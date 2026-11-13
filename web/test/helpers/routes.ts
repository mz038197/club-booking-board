/**
 * Route table for in-process HTTP tests: "METHOD /path/:param" → route module.
 * Add a line here for every new route.ts. Path params arrive the way
 * Next.js passes them: `{ params: Promise<{ ... }> }`.
 */
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type RouteModule = Record<string, unknown>;

export const ROUTES: Record<string, () => Promise<RouteModule>> = {
  "/api/v1/slots": () => import("@/app/api/v1/slots/route"),
  "/api/v1/bookings": () => import("@/app/api/v1/bookings/route"),
  "/api/v1/bookings/:id": () => import("@/app/api/v1/bookings/[id]/route"),
  "/auth/login": () => import("@/app/auth/login/route"),
  "/auth/callback": () => import("@/app/auth/callback/route"),
  "/auth/logout": () => import("@/app/auth/logout/route"),
  "/api/teacher/me": () => import("@/app/api/teacher/me/route"),
  "/api/teacher/classes/:classId": () => import("@/app/api/teacher/classes/[classId]/route"),
  "/api/teacher/classes/:classId/sessions": () => import("@/app/api/teacher/classes/[classId]/sessions/route"),
  "/api/teacher/sessions/:id": () => import("@/app/api/teacher/sessions/[id]/route"),
  "/api/teacher/sessions/:id/current": () => import("@/app/api/teacher/sessions/[id]/current/route"),
  "/api/teacher/sessions/:id/stats": () => import("@/app/api/teacher/sessions/[id]/stats/route"),
  "/api/teacher/sessions/:id/roster": () => import("@/app/api/teacher/sessions/[id]/roster/route"),
  "/api/teacher/sessions/:id/bookings": () => import("@/app/api/teacher/sessions/[id]/bookings/route"),
  "/api/teacher/sessions/:id/bookings/:bookingId": () =>
    import("@/app/api/teacher/sessions/[id]/bookings/[bookingId]/route"),
  "/api/teacher/sessions/:id/admin-log": () => import("@/app/api/teacher/sessions/[id]/admin-log/route"),
  "/api/teacher/sessions/:id/api-calls": () => import("@/app/api/teacher/sessions/[id]/api-calls/route"),
  "/api/teacher/sessions/:id/reset": () => import("@/app/api/teacher/sessions/[id]/reset/route"),
  "/api/teacher/sessions/:id/slots": () => import("@/app/api/teacher/sessions/[id]/slots/route"),
  "/api/teacher/sessions/:id/slots/generate": () => import("@/app/api/teacher/sessions/[id]/slots/generate/route"),
  "/api/teacher/sessions/:id/slots/:slotId": () => import("@/app/api/teacher/sessions/[id]/slots/[slotId]/route"),
};

export async function resolveRoute(
  method: string,
  pathname: string,
): Promise<{ handler: Handler; params: Record<string, string> } | null> {
  for (const [pattern, load] of Object.entries(ROUTES)) {
    const params = matchPath(pattern, pathname);
    if (!params) continue;
    const handler = (await load())[method];
    if (typeof handler !== "function") return null;
    return { handler: handler as Handler, params };
  }
  return null;
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const want = pattern.split("/");
  const got = pathname.split("/");
  if (want.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(":")) params[want[i].slice(1)] = decodeURIComponent(got[i]);
    else if (want[i] !== got[i]) return null;
  }
  return params;
}
