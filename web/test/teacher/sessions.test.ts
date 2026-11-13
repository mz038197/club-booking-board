import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAKE_KEYS, FAKE_TEACHERS } from "@/server/router-gateway/fake";
import { setupTestApp, type TestApp } from "../helpers/app";
import { teacherCookie } from "../helpers/teacher";

let app: TestApp;

beforeEach(async () => {
  app = await setupTestApp();
});
afterEach(async () => {
  await app.close();
});

const { teacher, otherTeacher, admin } = FAKE_TEACHERS;
const asTeacher = () => ({ cookies: teacherCookie(app, teacher) });

async function createSession(name: string, extra: Record<string, unknown> = {}, classId = 56) {
  const res = await app.request("POST", `/api/teacher/classes/${classId}/sessions`, {
    ...asTeacher(),
    body: { name, ...extra },
  });
  expect(res.status).toBe(201);
  return (await res.json()).session as { id: string; name: string };
}

async function studentSession() {
  const res = await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentA });
  return res.json();
}

async function generate(sessionId: string, rooms: string[]) {
  const res = await app.request("POST", `/api/teacher/sessions/${sessionId}/slots/generate`, {
    ...asTeacher(),
    body: { dates: ["2026-12-09"], times: [{ start: "12:10", end: "13:00" }], rooms },
  });
  expect(res.status).toBe(200);
}

async function sessionDetail(id: string) {
  const res = await app.request("GET", `/api/teacher/sessions/${id}`, asTeacher());
  expect(res.status).toBe(200);
  return res.json();
}

describe("建立堂課並複製舊堂課", () => {
  it("copies the 可借清單 and 預約規則, but not the 預約", async () => {
    const old = await createSession("12/09 社團教室");
    await generate(old.id, ["A101", "A102"]);
    const booked = await app.request("POST", "/api/v1/bookings", {
      key: FAKE_KEYS.studentA,
      body: { slot_id: "2026-12-09_12:10-13:00_A101" },
    });
    expect(booked.status).toBe(201);
    const rules = { per_student_limit: 3, booking_window: { start: "12:30", end: "15:10" } };
    const ruled = await app.request("PUT", `/api/teacher/sessions/${old.id}/rules`, { ...asTeacher(), body: rules });
    expect(ruled.status).toBe(200);
    // 暫停 is an in-class switch, not a rule: never copied.
    await app.request("PUT", `/api/teacher/sessions/${old.id}/pause`, { ...asTeacher(), body: { paused: true } });

    const copy = await createSession("12/16 社團教室", { copy_from: old.id });

    const detail = await sessionDetail(copy.id);
    expect(detail.session).toMatchObject({ name: "12/16 社團教室", is_current: true, paused: false, ...rules });
    expect(detail.slots).toEqual([
      expect.objectContaining({ slot_id: "2026-12-09_12:10-13:00_A101", status: "open" }),
      expect.objectContaining({ slot_id: "2026-12-09_12:10-13:00_A102", status: "open" }),
    ]);
    const mine = await app.request("GET", "/api/v1/bookings", { key: FAKE_KEYS.studentA });
    expect(await mine.json()).toMatchObject({ session: { id: copy.id }, bookings: [] });
    // the old 堂課 keeps its 預約
    expect((await sessionDetail(old.id)).slots[0]).toMatchObject({ status: "booked", booked_by: "07王小明" });
  });

  it("refuses to copy a 堂課 of another 班級 with 400 and creates nothing", async () => {
    const otherClass = await app.request("POST", "/api/teacher/classes/57/sessions", {
      cookies: teacherCookie(app, otherTeacher),
      body: { name: "週三" },
    });
    const otherId = (await otherClass.json()).session.id;

    for (const copy_from of [otherId, "not-a-uuid"]) {
      const res = await app.request("POST", "/api/teacher/classes/56/sessions", {
        ...asTeacher(),
        body: { name: "偷複製", copy_from },
      });
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("INVALID_REQUEST");
    }
    const list = await app.request("GET", "/api/teacher/classes/56/sessions", asTeacher());
    expect((await list.json()).sessions).toEqual([]);
  });
});

describe("POST /api/teacher/sessions/:id/current — 切回舊堂課", () => {
  it("makes the older 堂課 current again, and the student enters it", async () => {
    const old = await createSession("12/09 社團教室");
    await createSession("12/16 社團教室");

    const res = await app.request("POST", `/api/teacher/sessions/${old.id}/current`, asTeacher());

    expect(res.status).toBe(200);
    expect((await studentSession()).session).toEqual({ id: old.id, name: "12/09 社團教室" });
    expect((await sessionDetail(old.id)).session.is_current).toBe(true);
  });

  it("refuses another teacher's 堂課 with 403 and leaves the 目前堂課 alone", async () => {
    const old = await createSession("12/09 社團教室");
    const now = await createSession("12/16 社團教室");

    const res = await app.request("POST", `/api/teacher/sessions/${old.id}/current`, {
      cookies: teacherCookie(app, otherTeacher),
    });

    expect(res.status).toBe(403);
    expect((await studentSession()).session.id).toBe(now.id);
    expect((await app.request("GET", `/api/teacher/sessions/${old.id}`, { cookies: teacherCookie(app, otherTeacher) })).status).toBe(403);
  });
});

describe("POST /api/teacher/classes/:classId/sessions — 建立堂課", () => {
  it("makes the new 堂課 the 目前堂課, and the student enters it right away", async () => {
    const first = await createSession("12/09 社團教室");
    expect((await studentSession()).session).toEqual({ id: first.id, name: "12/09 社團教室" });

    const second = await createSession("12/16 社團教室");

    expect((await studentSession()).session).toEqual({ id: second.id, name: "12/16 社團教室" });
    const list = await app.request("GET", "/api/teacher/classes/56/sessions", asTeacher());
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({
      current_session_id: second.id,
      sessions: [
        { id: second.id, name: "12/16 社團教室", is_current: true },
        { id: first.id, name: "12/09 社團教室", is_current: false },
      ],
    });
  });

  it("answers 400 INVALID_REQUEST for a missing or blank name", async () => {
    for (const body of [{}, { name: "   " }, { name: 5 }]) {
      const res = await app.request("POST", "/api/teacher/classes/56/sessions", { ...asTeacher(), body });
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("INVALID_REQUEST");
    }
  });

  it("lists no 堂課 for a 班級 that has none", async () => {
    const res = await app.request("GET", "/api/teacher/classes/56/sessions", asTeacher());

    expect(await res.json()).toEqual({ current_session_id: null, sessions: [] });
  });

  it("refuses another teacher's 班級 with 403, needs a login, and lets an admin in", async () => {
    const other = { cookies: teacherCookie(app, otherTeacher) };
    expect((await app.request("GET", "/api/teacher/classes/56/sessions", other)).status).toBe(403);
    const post = await app.request("POST", "/api/teacher/classes/56/sessions", { ...other, body: { name: "x" } });
    expect(post.status).toBe(403);
    expect((await post.json()).code).toBe("FORBIDDEN");

    expect((await app.request("GET", "/api/teacher/classes/56/sessions")).status).toBe(401);

    const byAdmin = await app.request("POST", "/api/teacher/classes/56/sessions", {
      cookies: teacherCookie(app, admin),
      body: { name: "管理員建立" },
    });
    expect(byAdmin.status).toBe(201);
  });
});
