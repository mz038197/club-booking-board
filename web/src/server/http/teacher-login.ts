import { createHash, randomBytes } from "node:crypto";
import type { Deps } from "../deps";
import {
  cookieLine,
  readCookie,
  seal,
  teacherSessionCookie,
  unseal,
} from "./teacher-auth";

/** Holds the OAuth `state` and PKCE verifier between /auth/login and /auth/callback. */
export const LOGIN_COOKIE = "cbb_teacher_login";
const LOGIN_COOKIE_PATH = "/auth";
const LOGIN_SECONDS = 10 * 60;
export const CALLBACK_PATH = "/auth/callback";
export const ADMIN_PATH = "/admin";
export const LOGIN_PAGE_PATH = "/login";

/** `?error=` values the login page explains. */
export type LoginError = "login_failed" | "router_unavailable";

function redirect(to: URL, cookies: string[] = [], status = 302): Response {
  const headers = new Headers({ location: to.toString() });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status, headers });
}

const clearLoginCookie = () => cookieLine(LOGIN_COOKIE, "", { maxAge: 0, path: LOGIN_COOKIE_PATH });

/** 「用 Google 登入」: sends the browser to the router with PKCE (S256) and a state. */
export function startTeacherLogin(req: Request, deps: Deps): Response {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
  const exp = Math.floor(deps.now().getTime() / 1000) + LOGIN_SECONDS;
  const loginCookie = cookieLine(LOGIN_COOKIE, seal({ state, verifier, exp }, deps.sessionSecret), {
    maxAge: LOGIN_SECONDS,
    path: LOGIN_COOKIE_PATH,
  });
  const authorizeUrl = deps.gateway.teacherLoginUrl({
    redirectUri: new URL(CALLBACK_PATH, req.url).toString(),
    state,
    codeChallenge,
  });
  return redirect(new URL(authorizeUrl, req.url), [loginCookie]);
}

/**
 * The router's redirect back: checks state, has the gateway exchange the code
 * and verify the ID token, then sets the 12-hour session cookie.
 */
export async function finishTeacherLogin(req: Request, deps: Deps): Promise<Response> {
  const url = new URL(req.url);
  const fail = (error: LoginError) => {
    const to = new URL(LOGIN_PAGE_PATH, req.url);
    to.searchParams.set("error", error);
    return redirect(to, [clearLoginCookie()]);
  };

  const pending = unseal(readCookie(req, LOGIN_COOKIE), deps.sessionSecret);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (
    !pending ||
    typeof pending.state !== "string" ||
    typeof pending.verifier !== "string" ||
    typeof pending.exp !== "number" ||
    deps.now().getTime() / 1000 >= pending.exp ||
    !state ||
    state !== pending.state ||
    !code
  ) {
    return fail("login_failed");
  }

  const login = await deps.gateway.completeTeacherLogin({
    code,
    codeVerifier: pending.verifier,
    redirectUri: new URL(CALLBACK_PATH, req.url).toString(),
  });
  if (!login.ok) return fail(login.reason === "unavailable" ? "router_unavailable" : "login_failed");

  return redirect(new URL(ADMIN_PATH, req.url), [
    teacherSessionCookie(login.teacher, deps),
    clearLoginCookie(),
  ]);
}
