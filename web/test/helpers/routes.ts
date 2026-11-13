/**
 * Route table for in-process HTTP tests: "METHOD /path/:param" → route module.
 * Add a line here for every new route.ts. Path params arrive the way
 * Next.js passes them: `{ params: Promise<{ ... }> }`.
 */
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type RouteModule = Record<string, unknown>;

export const ROUTES: Record<string, () => Promise<RouteModule>> = {
  "/api/v1/slots": () => import("@/app/api/v1/slots/route"),
  "/auth/login": () => import("@/app/auth/login/route"),
  "/auth/callback": () => import("@/app/auth/callback/route"),
  "/auth/logout": () => import("@/app/auth/logout/route"),
  "/api/teacher/me": () => import("@/app/api/teacher/me/route"),
  "/api/teacher/classes/:classId": () => import("@/app/api/teacher/classes/[classId]/route"),
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
