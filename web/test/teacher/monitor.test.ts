import { afterEach, describe, expect, it } from "vitest";
import { FAKE_KEYS, FAKE_TEACHERS } from "@/server/router-gateway/fake";
import type { Teacher } from "@/server/router-gateway";
import { addSlots, createSession } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";
import { teacherCookie } from "../helpers/teacher";

let app: TestApp;

afterEach(async () => {
  await app.close();
});

const { teacher, otherTeacher, admin } = FAKE_TEACHERS;

const SLOT_301 = "2026-12-16_12:10-13:00_301";
const SLOT_302 = "2026-12-16_12:10-13:00_302";

/** 班級 56 (林老師) with a 目前堂課 of two 可借格. */
async function classWithSession() {
  const session = await createSession(app.db, { classId: 56, name: "12/16 第一堂" });
  await addSlots(app.db, session.id, [
    { date: "2026-12-16", start: "12:10", end: "13:00", room: "301" },
    { date: "2026-12-16", start: "12:10", end: "13:00", room: "302" },
  ]);
  return session;
}

function monitor(sessionId: string, who: Teacher = teacher) {
  return app.request("GET", `/api/teacher/sessions/${sessionId}/monitor`, {
    cookies: teacherCookie(app, who),
  });
}

describe("GET /api/teacher/sessions/:id/monitor — 誰能看投影監看", () => {
  it("refuses with 401 without a teacher cookie", async () => {
    app = await setupTestApp();
    const session = await classWithSession();

    const res = await app.request("GET", `/api/teacher/sessions/${session.id}/monitor`);

    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
  });

  it("refuses with 403 a teacher who does not own the 堂課's 班級", async () => {
    app = await setupTestApp();
    const session = await classWithSession();

    const res = await monitor(session.id, otherTeacher);

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  it("answers 404 for an unknown or malformed 堂課 id", async () => {
    app = await setupTestApp();

    for (const id of ["00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
      const res = await monitor(id);
      expect(res.status).toBe(404);
      expect((await res.json()).code).toBe("NOT_FOUND");
    }
  });

  it("lets the owner and an admin open it", async () => {
    app = await setupTestApp();
    const session = await classWithSession();

    expect((await monitor(session.id, teacher)).status).toBe(200);
    expect((await monitor(session.id, admin)).status).toBe(200);
  });
});

/** A clock the test moves one second at a time. */
function steppingClock(start = "2026-12-16T04:10:00Z") {
  let t = new Date(start).getTime();
  return {
    now: () => new Date(t),
    step: () => {
      t += 1000;
    },
  };
}

function book(key: string, slotId: string) {
  return app.request("POST", "/api/v1/bookings", { key, body: { slot_id: slotId } });
}

describe("GET /api/teacher/sessions/:id/monitor — 看板、名冊進度、API 呼叫紀錄", () => {
  it("shows a new 預約 on the next poll, with full 顯示名稱 when not masked", async () => {
    app = await setupTestApp();
    const session = await classWithSession();
    const before = await (await monitor(session.id)).json();
    expect(before.slots.map((s: { status: string }) => s.status)).toEqual(["open", "open"]);

    expect((await book(FAKE_KEYS.studentA, SLOT_301)).status).toBe(201);

    const after = await (await monitor(session.id)).json();
    expect(after.session).toEqual({ id: session.id, name: "12/16 第一堂", class_id: 56, paused: false });
    expect(after.settings).toEqual({ mask_names: false, auto_follow: false });
    expect(after.slots).toEqual([
      {
        slot_id: SLOT_301,
        date: "2026-12-16",
        start: "12:10",
        end: "13:00",
        room: "301",
        status: "booked",
        booked_by: "07王小明",
      },
      { slot_id: SLOT_302, date: "2026-12-16", start: "12:10", end: "13:00", room: "302", status: "open" },
    ]);
  });

  it("lists successes and failures newest first, marking a booking after a failed one as 換格重試", async () => {
    const clock = steppingClock();
    app = await setupTestApp({ now: clock.now });
    const session = await classWithSession();

    clock.step();
    await book(FAKE_KEYS.studentA, SLOT_301); // 201
    clock.step();
    await book(FAKE_KEYS.studentB, SLOT_301); // 409 SLOT_TAKEN
    clock.step();
    await book(FAKE_KEYS.studentB, SLOT_302); // 201 after a failure → retry
    clock.step();
    await book(FAKE_KEYS.studentB, "2026-12-19_12:10-13:00_301"); // 400 INVALID_SLOT
    clock.step();
    await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentA }); // 200

    const { calls } = await (await monitor(session.id)).json();

    expect(
      calls.map((c: Record<string, unknown>) => [c.display_name, c.action, c.slot_id, c.status, c.code, c.retry]),
    ).toEqual([
      ["07王小明", "listSlots", null, 200, null, false],
      ["08李小華", "bookSlot", "2026-12-19_12:10-13:00_301", 400, "INVALID_SLOT", false],
      ["08李小華", "bookSlot", SLOT_302, 201, null, true],
      ["08李小華", "bookSlot", SLOT_301, 409, "SLOT_TAKEN", false],
      ["07王小明", "bookSlot", SLOT_301, 201, null, false],
    ]);
    expect(calls[0]).toMatchObject({ student_id: 1234, at: "2026-12-16T04:10:05.000Z" });
    expect(new Set(calls.map((c: { id: number }) => c.id)).size).toBe(5);
  });

  it("shows 名冊進度: who has called, who has booked, which 教室 and in what order", async () => {
    const clock = steppingClock();
    app = await setupTestApp({ now: clock.now });
    const session = await classWithSession();

    clock.step();
    await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentB }); // calls first, books later
    clock.step();
    await book(FAKE_KEYS.studentA, SLOT_301);
    clock.step();
    await book(FAKE_KEYS.studentB, SLOT_302);

    const { roster } = await (await monitor(session.id)).json();

    expect(roster).toEqual([
      {
        student_id: 1235,
        display_name: "08李小華",
        first_call_at: "2026-12-16T04:10:01.000Z",
        first_booked_at: "2026-12-16T04:10:03.000Z",
        booked_count: 1,
        rooms: ["302"],
      },
      {
        student_id: 1234,
        display_name: "07王小明",
        first_call_at: "2026-12-16T04:10:02.000Z",
        first_booked_at: "2026-12-16T04:10:02.000Z",
        booked_count: 1,
        rooms: ["301"],
      },
    ]);
  });

  it("lists only students who have called; a student who cancelled keeps the 「已完成」 time but has no 教室", async () => {
    app = await setupTestApp();
    const session = await classWithSession();
    const res = await book(FAKE_KEYS.studentA, SLOT_301);
    const { booking_id } = await res.json();
    await app.request("DELETE", `/api/v1/bookings/${booking_id}`, { key: FAKE_KEYS.studentA });

    const { roster } = await (await monitor(session.id)).json();

    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({ student_id: 1234, booked_count: 0, rooms: [] });
    expect(roster[0].first_booked_at).not.toBeNull();
  });
});

function setDisplay(sessionId: string, body: unknown, who: Teacher = teacher) {
  return app.request("PATCH", `/api/teacher/sessions/${sessionId}/display-settings`, {
    cookies: teacherCookie(app, who),
    body,
  });
}

describe("PATCH /api/teacher/sessions/:id/display-settings — 投影顯示設定", () => {
  it("turns on 遮蔽名稱 and 自動跳日, and the monitor reports them", async () => {
    app = await setupTestApp();
    const session = await classWithSession();

    const res = await setDisplay(session.id, { mask_names: true, auto_follow: true });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ settings: { mask_names: true, auto_follow: true } });
    expect((await (await monitor(session.id)).json()).settings).toEqual({ mask_names: true, auto_follow: true });
  });

  it("changes only the fields sent", async () => {
    app = await setupTestApp();
    const session = await classWithSession();
    await setDisplay(session.id, { mask_names: true, auto_follow: true });

    const res = await setDisplay(session.id, { auto_follow: false });

    expect(await res.json()).toEqual({ settings: { mask_names: true, auto_follow: false } });
  });

  it("masks every 顯示名稱 on the monitor (07王小明 → 07王○明)", async () => {
    app = await setupTestApp();
    const session = await classWithSession();
    await book(FAKE_KEYS.studentA, SLOT_301);
    await setDisplay(session.id, { mask_names: true });

    const snap = await (await monitor(session.id)).json();

    expect(snap.slots[0].booked_by).toBe("07王○明");
    expect(snap.roster[0].display_name).toBe("07王○明");
    expect(snap.calls[0].display_name).toBe("07王○明");
    expect(JSON.stringify(snap)).not.toContain("王小明");
  });

  it("does not mask anything students see (遮蔽只影響投影頁)", async () => {
    app = await setupTestApp();
    const session = await classWithSession();
    await book(FAKE_KEYS.studentA, SLOT_301);
    await setDisplay(session.id, { mask_names: true });

    const res = await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentB });

    expect(JSON.stringify(await res.json())).toContain("07王小明");
  });

  it("refuses a body that is not booleans with 400 INVALID_REQUEST", async () => {
    app = await setupTestApp();
    const session = await classWithSession();

    for (const body of [{ mask_names: "yes" }, {}, [], null]) {
      const res = await setDisplay(session.id, body);
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("INVALID_REQUEST");
    }
  });

  it("refuses without a cookie (401), for another teacher's 班級 (403), unknown 堂課 (404); admin allowed", async () => {
    app = await setupTestApp();
    const session = await classWithSession();

    const anonymous = await app.request("PATCH", `/api/teacher/sessions/${session.id}/display-settings`, {
      body: { mask_names: true },
    });
    expect(anonymous.status).toBe(401);
    expect((await setDisplay(session.id, { mask_names: true }, otherTeacher)).status).toBe(403);
    expect((await setDisplay("00000000-0000-4000-8000-000000000000", { mask_names: true })).status).toBe(404);
    expect((await setDisplay(session.id, { mask_names: true }, admin)).status).toBe(200);
    expect((await (await monitor(session.id)).json()).settings.mask_names).toBe(true);
  });
});
