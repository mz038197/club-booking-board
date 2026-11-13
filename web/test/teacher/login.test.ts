import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAKE_TEACHERS, fakeApproveLogin } from "@/server/router-gateway/fake";
import { setupTestApp, type TestApp } from "../helpers/app";
import { setCookies } from "../helpers/teacher";

let app: TestApp;

beforeEach(async () => {
  app = await setupTestApp();
});
afterEach(async () => {
  await app.close();
});

/** 「用 Google 登入」: returns where the browser is sent and the login cookie it carries. */
async function startLogin() {
  const res = await app.request("GET", "/auth/login");
  expect(res.status).toBe(302);
  const cookies = setCookies(res);
  const loginCookie = Object.fromEntries(
    Object.entries(cookies).map(([name, c]) => [name, c.value]),
  );
  return { authorizeUrl: res.headers.get("location")!, loginCookie };
}

/** Follows the router's redirect back to our callback. */
function callback(callbackUrl: string, cookies: Record<string, string>) {
  const url = new URL(callbackUrl);
  return app.request("GET", url.pathname + url.search, { cookies });
}

describe("teacher login through the router", () => {
  it("sends the teacher to the router's authorize page with a PKCE challenge and state", async () => {
    const { authorizeUrl, loginCookie } = await startLogin();

    const params = new URL(authorizeUrl).searchParams;
    expect(params.get("redirect_uri")).toBe("http://localhost/auth/callback");
    expect(params.get("state")).toMatch(/^[\w-]{20,}$/);
    expect(params.get("code_challenge")).toMatch(/^[\w-]{43}$/);
    expect(Object.keys(loginCookie)).toHaveLength(1);
  });

  it("signs the teacher in with a 12-hour HttpOnly, Secure, SameSite=Lax cookie and lands on the admin", async () => {
    const { authorizeUrl, loginCookie } = await startLogin();

    const res = await callback(fakeApproveLogin(authorizeUrl, FAKE_TEACHERS.teacher.userId), loginCookie);

    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin");
    const session = setCookies(res).cbb_teacher;
    expect(session).toBeDefined();
    expect(session.line).toMatch(/HttpOnly/i);
    expect(session.line).toMatch(/Secure/i);
    expect(session.line).toMatch(/SameSite=Lax/i);
    expect(session.line).toMatch(/Max-Age=43200/i);

    const me = await app.request("GET", "/api/teacher/me", {
      cookies: { cbb_teacher: session.value },
    });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({
      teacher: { user_id: 42, display_name: "林老師" },
      is_admin: false,
      classes: [{ id: 56, name: "週一 程式設計" }],
    });
  });

  it("the session cookie carries only the teacher id and 顯示名稱 (no router key)", async () => {
    const { authorizeUrl, loginCookie } = await startLogin();
    const res = await callback(fakeApproveLogin(authorizeUrl, FAKE_TEACHERS.teacher.userId), loginCookie);

    const [payload] = setCookies(res).cbb_teacher.value.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    expect(Object.keys(claims).sort()).toEqual(["exp", "name", "uid"]);
  });

  it("fails the login when the state does not match", async () => {
    const { authorizeUrl, loginCookie } = await startLogin();
    const url = new URL(fakeApproveLogin(authorizeUrl, FAKE_TEACHERS.teacher.userId));
    url.searchParams.set("state", "forged");

    const res = await callback(url.toString(), loginCookie);

    expectLoginFailed(res);
  });

  it("fails the login without the login cookie (callback not started here)", async () => {
    const { authorizeUrl } = await startLogin();

    const res = await callback(fakeApproveLogin(authorizeUrl, FAKE_TEACHERS.teacher.userId), {});

    expectLoginFailed(res);
  });

  it("fails the login when the router does not accept the code (wrong PKCE verifier)", async () => {
    const first = await startLogin();
    const second = await startLogin();

    // Code issued for the first login's challenge, redeemed with the second login's verifier.
    const url = new URL(fakeApproveLogin(first.authorizeUrl, FAKE_TEACHERS.teacher.userId));
    url.searchParams.set("state", new URL(second.authorizeUrl).searchParams.get("state")!);
    const res = await callback(url.toString(), second.loginCookie);

    expectLoginFailed(res);
  });

  it("fails the login when the router reports an error (e.g. not a teacher)", async () => {
    const { authorizeUrl, loginCookie } = await startLogin();
    const state = new URL(authorizeUrl).searchParams.get("state")!;

    const res = await app.request("GET", `/auth/callback?error=access_denied&state=${state}`, {
      cookies: loginCookie,
    });

    expectLoginFailed(res);
  });
});

describe("teacher logout", () => {
  it("clears the session cookie and returns to the login page", async () => {
    const res = await app.request("POST", "/auth/logout");

    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    const cleared = setCookies(res).cbb_teacher;
    expect(cleared.value).toBe("");
    expect(cleared.line).toMatch(/Max-Age=0/i);
  });
});

function expectLoginFailed(res: Response) {
  expect(res.status).toBe(302);
  const location = new URL(res.headers.get("location")!);
  expect(location.pathname).toBe("/login");
  expect(location.searchParams.get("error")).toBeTruthy();
  expect(setCookies(res).cbb_teacher?.value ?? "").toBe("");
}
