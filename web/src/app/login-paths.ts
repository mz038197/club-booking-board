// Client-safe (no node imports): where login flows land, shared by route handlers and pages.

/** The 首頁 (landing): where signed-out teachers, failed logins and logouts land. */
export const HOME_PATH = "/";

/** Where a teacher page sends a signed-out teacher: the 首頁 with a 「請先登入」 banner. */
export const LOGIN_REQUIRED_PATH = "/?notice=login_required";

/** `?error=` values the 首頁 explains. */
export type LoginError = "login_failed" | "router_unavailable";

/** The 首頁's `?error=` as a known LoginError (unknown values read as login_failed), or null. */
export function loginErrorParam(value: string | string[] | undefined): LoginError | null {
  if (typeof value !== "string" || value === "") return null;
  return value === "router_unavailable" ? "router_unavailable" : "login_failed";
}

/** The 首頁 showing a login error. */
export const loginErrorPath = (error: LoginError) => `${HOME_PATH}?error=${error}`;
