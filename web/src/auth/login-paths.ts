// Client-safe (no node imports): the teacher login flow's paths and 首頁 query params,
// shared by route handlers, server pages and client components.

/** The 首頁 (landing): where signed-out teachers, failed logins and logouts land. */
export const HOME_PATH = "/";
/** 「登入」: answers with a redirect to the router's login page. */
export const LOGIN_START_PATH = "/auth/login";
export const ADMIN_PATH = "/admin";

/** `?error=` values the 首頁 explains. */
export type LoginError = "login_failed" | "router_unavailable";

/** `?notice=` value: a teacher page was opened while signed out. */
const LOGIN_REQUIRED = "login_required";

/** Where a teacher page sends a signed-out teacher: the 首頁 with a 「請先登入」 banner. */
export const LOGIN_REQUIRED_PATH = `${HOME_PATH}?notice=${LOGIN_REQUIRED}`;

/** The 首頁 showing a login error. */
export const loginErrorPath = (error: LoginError) => `${HOME_PATH}?error=${error}`;

type Param = string | string[] | undefined;

/** The 首頁's `?error=` as a known LoginError (unknown values read as login_failed), or null. */
export function loginErrorParam(value: Param): LoginError | null {
  if (typeof value !== "string" || value === "") return null;
  return value === "router_unavailable" ? "router_unavailable" : "login_failed";
}

/** Whether the 首頁's `?notice=` says a teacher page was opened while signed out. */
export const loginRequiredParam = (value: Param): boolean => value === LOGIN_REQUIRED;
