import { afterEach, describe, expect, it } from "vitest";
import accepted from "../fixtures/router/teacher-classes/accepted.json";
import { createRouterGateway } from "@/server/router-gateway/real";
import { FAKE_TEACHERS } from "@/server/router-gateway/fake";
import { TEACHER_COOKIE } from "@/server/http/teacher-auth";
import { setupTestApp, type TestApp } from "../helpers/app";
import { teacherCookie } from "../helpers/teacher";

let app: TestApp;

afterEach(async () => {
  await app.close();
});

const { teacher, otherTeacher, noClasses, admin } = FAKE_TEACHERS;

describe("GET /api/teacher/me — 教師身分與可管理的班級", () => {
  it("shows a teacher with no 班級 an empty list (page: 「你沒有可管理的班級」)", async () => {
    app = await setupTestApp();

    const res = await app.request("GET", "/api/teacher/me", { cookies: teacherCookie(app, noClasses) });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      teacher: { user_id: 44, display_name: "張老師" },
      is_admin: false,
      classes: [],
    });
  });

  it("tells an admin they manage every 班級", async () => {
    app = await setupTestApp();

    const res = await app.request("GET", "/api/teacher/me", { cookies: teacherCookie(app, admin) });

    expect(await res.json()).toMatchObject({ is_admin: true, classes: [{ id: 56 }, { id: 57 }] });
  });

  it("refuses with 401 without a cookie", async () => {
    app = await setupTestApp();

    const res = await app.request("GET", "/api/teacher/me");

    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
  });

  it("refuses with 401 when the cookie's signature is wrong", async () => {
    app = await setupTestApp();
    const [payload, signature] = teacherCookie(app, teacher)[TEACHER_COOKIE].split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ uid: admin.userId, name: "x", exp: 9_999_999_999 }),
    ).toString("base64url");

    for (const value of [`${forgedPayload}.${signature}`, `${payload}.AAAA`, payload, "garbage"]) {
      const res = await app.request("GET", "/api/teacher/me", { cookies: { [TEACHER_COOKIE]: value } });
      expect(res.status).toBe(401);
    }
  });

  it("refuses with 401 once the cookie is older than 12 hours", async () => {
    let now = new Date("2026-12-09T00:00:00Z");
    app = await setupTestApp({ now: () => now });
    const cookies = teacherCookie(app, teacher);

    now = new Date("2026-12-09T11:59:59Z");
    expect((await app.request("GET", "/api/teacher/me", { cookies })).status).toBe(200);

    now = new Date("2026-12-09T12:00:00Z");
    expect((await app.request("GET", "/api/teacher/me", { cookies })).status).toBe(401);
  });
});

describe("GET /api/teacher/classes/:classId — 班級存取檢查", () => {
  it("lets a teacher open a 班級 they own", async () => {
    app = await setupTestApp();

    const res = await app.request("GET", "/api/teacher/classes/56", { cookies: teacherCookie(app, teacher) });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ class: { id: 56, name: "週一 程式設計" } });
  });

  it("refuses a 班級 owned by another teacher with 403 FORBIDDEN", async () => {
    app = await setupTestApp();

    const res = await app.request("GET", "/api/teacher/classes/56", {
      cookies: teacherCookie(app, otherTeacher),
    });

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  it("lets an admin open any 班級", async () => {
    app = await setupTestApp();

    for (const id of [56, 57, 999]) {
      const res = await app.request("GET", `/api/teacher/classes/${id}`, { cookies: teacherCookie(app, admin) });
      expect(res.status).toBe(200);
    }
  });

  it("refuses with 401 without a cookie", async () => {
    app = await setupTestApp();

    expect((await app.request("GET", "/api/teacher/classes/56")).status).toBe(401);
  });

  it("answers 400 INVALID_REQUEST for a non-numeric 班級 id", async () => {
    app = await setupTestApp();

    const res = await app.request("GET", "/api/teacher/classes/abc", { cookies: teacherCookie(app, teacher) });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_REQUEST");
  });
});

describe("losing ownership of a 班級 in the router", () => {
  it("takes effect within 60 seconds", async () => {
    let now = new Date("2026-12-09T04:00:00Z");
    let classes = accepted.classes;
    const router = (async () =>
      Response.json({ ...accepted, user_id: 42, classes })) as unknown as typeof fetch;
    const gateway = createRouterGateway({
      routerUrl: "https://router.test",
      serviceCredential: "svc",
      fetch: router,
      now: () => now.getTime(),
      log: () => {},
    });
    app = await setupTestApp({ gateway, now: () => now });
    const cookies = teacherCookie(app, teacher);
    const open56 = () => app.request("GET", "/api/teacher/classes/56", { cookies });

    expect((await open56()).status).toBe(200);

    classes = accepted.classes.filter((c) => c.id !== 56); // router takes 56 away
    now = new Date("2026-12-09T04:00:30Z");
    expect((await open56()).status).toBe(200); // still within the 60 s cache

    now = new Date("2026-12-09T04:01:00Z");
    expect((await open56()).status).toBe(403);
  });

  it("answers 503 ROUTER_UNAVAILABLE when the router cannot say which 班級", async () => {
    const gateway = createRouterGateway({
      routerUrl: "https://router.test",
      serviceCredential: "svc",
      fetch: (async () => new Response("down", { status: 502 })) as unknown as typeof fetch,
      log: () => {},
    });
    app = await setupTestApp({ gateway });

    const res = await app.request("GET", "/api/teacher/me", { cookies: teacherCookie(app, teacher) });

    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("ROUTER_UNAVAILABLE");
  });
});
