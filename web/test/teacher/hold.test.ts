import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAKE_KEYS, FAKE_TEACHERS } from "@/server/router-gateway/fake";
import type { Teacher } from "@/server/router-gateway";
import { addSlots, createSession, type Session } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";
import { teacherCookie } from "../helpers/teacher";

let app: TestApp;
let session: Session;

const { teacher, otherTeacher } = FAKE_TEACHERS;

const SLOT_301 = "2026-12-16_12:10-13:00_301";
const SLOT_302 = "2026-12-16_12:10-13:00_302";

beforeEach(async () => {
  app = await setupTestApp();
  session = await createSession(app.db, { classId: 56, name: "12/16 第一堂" });
  await addSlots(app.db, session.id, [
    { date: "2026-12-16", start: "12:10", end: "13:00", room: "301" },
    { date: "2026-12-16", start: "12:10", end: "13:00", room: "302" },
  ]);
});
afterEach(async () => {
  await app.close();
});

const holdPath = (slotId: string, sessionId = session.id) =>
  `/api/teacher/sessions/${sessionId}/slots/${encodeURIComponent(slotId)}/hold`;

function setHold(slotId: string, body: unknown = {}, who: Teacher = teacher) {
  return app.request("PUT", holdPath(slotId), { cookies: teacherCookie(app, who), body });
}

function releaseHold(slotId: string, who: Teacher = teacher) {
  return app.request("DELETE", holdPath(slotId), { cookies: teacherCookie(app, who) });
}

async function studentSlots(key: string = FAKE_KEYS.studentA) {
  const res = await app.request("GET", "/api/v1/slots", { key });
  expect(res.status).toBe(200);
  return (await res.json()).slots as Record<string, unknown>[];
}

const slotOf = (slots: Record<string, unknown>[], slotId: string) => slots.find((s) => s.slot_id === slotId);

describe("PUT /api/teacher/sessions/:id/slots/:slotId/hold — 設定教師保留", () => {
  it("makes the 可借格 已借 for students, with the 保留 name as the booker", async () => {
    const res = await setHold(SLOT_301, { name: "熱舞社" });

    expect(res.status).toBe(200);
    expect(slotOf(await studentSlots(), SLOT_301)).toEqual({
      slot_id: SLOT_301,
      date: "2026-12-16",
      start: "12:10",
      end: "13:00",
      room: "301",
      status: "booked",
      booked_by: "熱舞社",
    });
    expect(slotOf(await studentSlots(), SLOT_302)?.status).toBe("open");
  });

  it("shows 「保留」 when the name is missing or blank", async () => {
    expect(await (await setHold(SLOT_301)).json()).toEqual({ slot_id: SLOT_301, name: "保留" });
    expect((await setHold(SLOT_302, { name: "   " })).status).toBe(200);

    const slots = await studentSlots();
    expect(slotOf(slots, SLOT_301)?.booked_by).toBe("保留");
    expect(slotOf(slots, SLOT_302)?.booked_by).toBe("保留");
  });

  it("takes a name of up to 20 characters and refuses a longer one with 400", async () => {
    const twenty = "熱".repeat(20);
    expect((await setHold(SLOT_301, { name: twenty })).status).toBe(200);

    const res = await setHold(SLOT_302, { name: "熱".repeat(21) });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_REQUEST");
    expect(slotOf(await studentSlots(), SLOT_301)?.booked_by).toBe(twenty);
    expect(slotOf(await studentSlots(), SLOT_302)?.status).toBe("open");
  });

  it("renames the 保留 when set again", async () => {
    await setHold(SLOT_301, { name: "熱舞社" });
    await setHold(SLOT_301, { name: "吉他社" });

    expect(slotOf(await studentSlots(), SLOT_301)?.booked_by).toBe("吉他社");
  });

  it("refuses with 409 CONFLICT a 可借格 a student has booked", async () => {
    await app.request("POST", "/api/v1/bookings", { key: FAKE_KEYS.studentB, body: { slot_id: SLOT_301 } });

    const res = await setHold(SLOT_301, { name: "熱舞社" });

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CONFLICT");
    expect(slotOf(await studentSlots(), SLOT_301)?.booked_by).toBe("08李小華");
  });

  it("answers 404 for a 可借格 the 堂課 does not have", async () => {
    const res = await setHold("2026-12-16_12:10-13:00_999");

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("refuses a teacher who does not own the 堂課's 班級", async () => {
    const res = await setHold(SLOT_301, {}, otherTeacher);

    expect(res.status).toBe(403);
    expect(slotOf(await studentSlots(), SLOT_301)?.status).toBe("open");
  });
});

describe("DELETE /api/teacher/sessions/:id/slots/:slotId/hold — 解除保留", () => {
  it("opens the 可借格 again, so a student can book it", async () => {
    await setHold(SLOT_301, { name: "熱舞社" });

    const res = await releaseHold(SLOT_301);

    expect(res.status).toBe(204);
    expect(slotOf(await studentSlots(), SLOT_301)?.status).toBe("open");
    const booked = await app.request("POST", "/api/v1/bookings", {
      key: FAKE_KEYS.studentA,
      body: { slot_id: SLOT_301 },
    });
    expect(booked.status).toBe(201);
  });

  it("answers 404 when the 可借格 has no 保留", async () => {
    const res = await releaseHold(SLOT_301);

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("refuses a teacher who does not own the 堂課's 班級", async () => {
    await setHold(SLOT_301);

    expect((await releaseHold(SLOT_301, otherTeacher)).status).toBe(403);
    expect(slotOf(await studentSlots(), SLOT_301)?.status).toBe("booked");
  });
});

describe("教師操作紀錄", () => {
  it("records setting and releasing a 保留", async () => {
    await setHold(SLOT_301, { name: "熱舞社" });
    await releaseHold(SLOT_301);

    const res = await app.request("GET", `/api/teacher/sessions/${session.id}/admin-log`, {
      cookies: teacherCookie(app, teacher),
    });
    const entries = (await res.json()).entries as { action: string; message: string }[];

    expect(entries.map((e) => e.action).slice(0, 2)).toEqual(["releaseHold", "setHold"]);
    expect(entries[1].message).toContain("熱舞社");
    expect(entries[1].message).toContain(SLOT_301);
    expect(entries[0].message).toContain(SLOT_301);
  });
});

describe("保留與其他教師操作", () => {
  it("survives 重置堂課", async () => {
    await setHold(SLOT_301, { name: "熱舞社" });

    const res = await app.request("POST", `/api/teacher/sessions/${session.id}/reset`, {
      cookies: teacherCookie(app, teacher),
    });

    expect(res.status).toBe(204);
    expect(slotOf(await studentSlots(), SLOT_301)).toMatchObject({ status: "booked", booked_by: "熱舞社" });
  });

  it("does not block 整批覆寫; a dropped 可借格 loses its 保留", async () => {
    await setHold(SLOT_301, { name: "熱舞社" });
    const cookies = teacherCookie(app, teacher);
    const only302 = { slots: [{ date: "2026-12-16", start: "12:10", end: "13:00", room: "302" }] };
    const both = {
      slots: [
        { date: "2026-12-16", start: "12:10", end: "13:00", room: "301" },
        { date: "2026-12-16", start: "12:10", end: "13:00", room: "302" },
      ],
    };

    expect((await app.request("PUT", `/api/teacher/sessions/${session.id}/slots`, { cookies, body: only302 })).status).toBe(200);
    await app.request("PUT", `/api/teacher/sessions/${session.id}/slots`, { cookies, body: both });

    expect(slotOf(await studentSlots(), SLOT_301)?.status).toBe("open");
  });

  it("does not block 移除單格; the 保留 goes with it", async () => {
    await setHold(SLOT_301, { name: "熱舞社" });
    const cookies = teacherCookie(app, teacher);

    const res = await app.request(
      "DELETE",
      `/api/teacher/sessions/${session.id}/slots/${encodeURIComponent(SLOT_301)}`,
      { cookies },
    );

    expect(res.status).toBe(204);
    await app.request("PUT", `/api/teacher/sessions/${session.id}/slots`, {
      cookies,
      body: {
        slots: [
          { date: "2026-12-16", start: "12:10", end: "13:00", room: "301" },
          { date: "2026-12-16", start: "12:10", end: "13:00", room: "302" },
        ],
      },
    });
    expect(slotOf(await studentSlots(), SLOT_301)?.status).toBe("open");
  });

  it("does not count toward any student's 每人上限", async () => {
    await setHold(SLOT_301);

    const res = await app.request("POST", "/api/v1/bookings", {
      key: FAKE_KEYS.studentA,
      body: { slot_id: SLOT_302 },
    });

    expect(res.status).toBe(201);
    const mine = await app.request("GET", "/api/v1/bookings", { key: FAKE_KEYS.studentA });
    expect(((await mine.json()).bookings as unknown[]).length).toBe(1);
  });
});

async function monitorSlots() {
  const res = await app.request("GET", `/api/teacher/sessions/${session.id}/monitor`, {
    cookies: teacherCookie(app, teacher),
  });
  expect(res.status).toBe(200);
  return (await res.json()).slots as Record<string, unknown>[];
}

describe("教師畫面分得出保留與學生預約", () => {
  it("marks a 保留 as held on the monitor, and a student's 預約 not", async () => {
    await setHold(SLOT_301, { name: "熱舞社" });
    await app.request("POST", "/api/v1/bookings", { key: FAKE_KEYS.studentB, body: { slot_id: SLOT_302 } });

    const slots = await monitorSlots();

    expect(slotOf(slots, SLOT_301)).toMatchObject({ status: "booked", booked_by: "熱舞社", held: true });
    expect(slotOf(slots, SLOT_302)).toMatchObject({ status: "booked", booked_by: "08李小華" });
    expect(slotOf(slots, SLOT_302)).not.toHaveProperty("held");
  });

  it("keeps the 保留 name whole when 遮蔽名稱 is on", async () => {
    await setHold(SLOT_301, { name: "熱舞社" });
    await app.request("POST", "/api/v1/bookings", { key: FAKE_KEYS.studentB, body: { slot_id: SLOT_302 } });
    await app.request("PATCH", `/api/teacher/sessions/${session.id}/display-settings`, {
      cookies: teacherCookie(app, teacher),
      body: { mask_names: true },
    });

    const slots = await monitorSlots();

    expect(slotOf(slots, SLOT_301)?.booked_by).toBe("熱舞社");
    expect(slotOf(slots, SLOT_302)?.booked_by).not.toBe("08李小華");
  });

  it("does not mark the 保留 on the 分享連結", async () => {
    await setHold(SLOT_301, { name: "熱舞社" });
    const link = await app.request("POST", `/api/teacher/sessions/${session.id}/share-link`, {
      cookies: teacherCookie(app, teacher),
    });
    const { token } = (await link.json()).share_link as { token: string };

    const res = await app.request("GET", `/api/share/${token}`);

    expect(slotOf((await res.json()).slots, SLOT_301)).toEqual({
      slot_id: SLOT_301,
      date: "2026-12-16",
      start: "12:10",
      end: "13:00",
      room: "301",
      status: "booked",
      booked_by: "熱舞社",
    });
  });
});

describe("預約保留格", () => {
  it("answers 409 SLOT_TAKEN, the same as any 已借 可借格", async () => {
    await setHold(SLOT_301);

    const res = await app.request("POST", "/api/v1/bookings", {
      key: FAKE_KEYS.studentA,
      body: { slot_id: SLOT_301 },
    });

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("SLOT_TAKEN");
  });
});
