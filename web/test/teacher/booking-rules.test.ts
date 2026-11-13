import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Teacher } from "@/server/router-gateway";
import { FAKE_TEACHERS } from "@/server/router-gateway/fake";
import { setupTestApp, type TestApp } from "../helpers/app";
import { teacherCookie } from "../helpers/teacher";

// 預約規則 form and 暫停 switch, teacher side.

let app: TestApp;
let sessionId: string;

const { teacher, otherTeacher, admin } = FAKE_TEACHERS;
const as = (t: Teacher = teacher) => ({ cookies: teacherCookie(app, t) });

beforeEach(async () => {
  app = await setupTestApp();
  const res = await app.request("POST", "/api/teacher/classes/56/sessions", { ...as(), body: { name: "12/09" } });
  sessionId = (await res.json()).session.id;
});
afterEach(async () => {
  await app.close();
});

async function detail() {
  const res = await app.request("GET", `/api/teacher/sessions/${sessionId}`, as());
  return (await res.json()).session;
}

describe("PUT /api/teacher/sessions/:id/rules", () => {
  it("starts with 每人上限 1, no 時間窗, not paused", async () => {
    expect(await detail()).toMatchObject({ per_student_limit: 1, booking_window: null, paused: false });
  });

  it("saves 每人上限 and 時間窗, shown in the 堂課 detail", async () => {
    const rules = { per_student_limit: 3, booking_window: { start: "12:30", end: "15:10" } };
    const res = await app.request("PUT", `/api/teacher/sessions/${sessionId}/rules`, { ...as(), body: rules });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rules);
    expect(await detail()).toMatchObject(rules);
  });

  it("clears the 時間窗 with null", async () => {
    const put = (body: unknown) =>
      app.request("PUT", `/api/teacher/sessions/${sessionId}/rules`, { ...as(), body });
    await put({ per_student_limit: 2, booking_window: { start: "12:30", end: "15:10" } });
    await put({ per_student_limit: 2, booking_window: null });

    expect(await detail()).toMatchObject({ per_student_limit: 2, booking_window: null });
  });

  it.each([
    { per_student_limit: 0, booking_window: null },
    { per_student_limit: 6, booking_window: null },
    { per_student_limit: 1.5, booking_window: null },
    { per_student_limit: "2", booking_window: null },
    { per_student_limit: 2, booking_window: { start: "15:10", end: "12:30" } },
    { per_student_limit: 2, booking_window: { start: "12:30", end: "12:30" } },
    { per_student_limit: 2, booking_window: { start: "25:00", end: "26:00" } },
    { per_student_limit: 2, booking_window: { start: "12:30" } },
  ])("refuses %j with 400 INVALID_REQUEST and keeps the old rules", async (body) => {
    const res = await app.request("PUT", `/api/teacher/sessions/${sessionId}/rules`, { ...as(), body });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_REQUEST");
    expect(await detail()).toMatchObject({ per_student_limit: 1, booking_window: null });
  });
});

describe("PUT /api/teacher/sessions/:id/pause", () => {
  it("pauses and resumes; shown in the 堂課 detail", async () => {
    const put = (paused: unknown) =>
      app.request("PUT", `/api/teacher/sessions/${sessionId}/pause`, { ...as(), body: { paused } });

    expect(await (await put(true)).json()).toEqual({ paused: true });
    expect((await detail()).paused).toBe(true);
    await put(false);
    expect((await detail()).paused).toBe(false);
    expect((await put("yes")).status).toBe(400);
  });
});

describe("access", () => {
  const calls = [
    ["rules", { per_student_limit: 2, booking_window: null }],
    ["pause", { paused: true }],
  ] as const;

  it.each(calls)("%s: 401 without login, 403 for another teacher's 班級, admin allowed", async (path, body) => {
    const url = `/api/teacher/sessions/${sessionId}/${path}`;
    expect((await app.request("PUT", url, { body })).status).toBe(401);
    const other = await app.request("PUT", url, { ...as(otherTeacher), body });
    expect(other.status).toBe(403);
    expect((await other.json()).code).toBe("FORBIDDEN");
    expect((await app.request("PUT", url, { ...as(admin), body })).status).toBe(200);
  });

  it.each(calls)("%s: 404 for an unknown 堂課", async (path, body) => {
    const res = await app.request("PUT", `/api/teacher/sessions/00000000-0000-0000-0000-000000000000/${path}`, {
      ...as(),
      body,
    });
    expect(res.status).toBe(404);
  });
});
