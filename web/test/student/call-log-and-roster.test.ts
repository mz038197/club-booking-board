import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiCallsOf } from "@/server/call-log";
import type { RouterGateway } from "@/server/router-gateway";
import { createFakeGateway, FAKE_KEYS } from "@/server/router-gateway/fake";
import { rosterOf } from "@/server/students";
import { addSlots, createSession, type Session } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";

// The call log and 名冊 have no endpoint yet (#20); read them through the
// data functions the teacher endpoints will expose.

const A101 = "2026-12-09_13:00-14:00_A101";
const A102 = "2026-12-09_13:00-14:00_A102";

let app: TestApp;
let session: Session;
let clock: Date;

/** Fake gateway whose student A's 顯示名稱 can be changed mid-test. */
let nameOfA = "07王小明";
const fake = createFakeGateway({});
const renamingGateway: RouterGateway = {
  ...fake,
  async checkStudentKey(key) {
    const check = await fake.checkStudentKey(key);
    if (check.ok && key === FAKE_KEYS.studentA) {
      return { ok: true, student: { ...check.student, displayName: nameOfA } };
    }
    return check;
  },
};

beforeEach(async () => {
  clock = new Date("2026-12-09T05:00:00.000Z");
  nameOfA = "07王小明";
  app = await setupTestApp({ gateway: renamingGateway, now: () => clock });
  session = await createSession(app.db, { classId: 56, name: "12/09" });
  await addSlots(app.db, session.id, [
    { date: "2026-12-09", start: "13:00", end: "14:00", room: "A101" },
    { date: "2026-12-09", start: "13:00", end: "14:00", room: "A102" },
  ]);
});
afterEach(async () => {
  await app.close();
});

const at = (iso: string) => {
  clock = new Date(iso);
};
const book = (key: string, slotId: string) =>
  app.request("POST", "/api/v1/bookings", { key, body: { slot_id: slotId } });

describe("API 呼叫紀錄", () => {
  it("records every student call, successes and failures, with time, student, action, slot, status and code", async () => {
    at("2026-12-09T05:00:01.000Z");
    await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentA });
    at("2026-12-09T05:00:02.000Z");
    await book(FAKE_KEYS.studentA, A101);
    at("2026-12-09T05:00:03.000Z");
    await book(FAKE_KEYS.studentB, A101);
    at("2026-12-09T05:00:04.000Z");
    await book(FAKE_KEYS.studentB, "nonsense");
    at("2026-12-09T05:00:05.000Z");
    const { booking_id } = await (await book(FAKE_KEYS.studentB, A102)).json();
    at("2026-12-09T05:00:06.000Z");
    await app.request("DELETE", `/api/v1/bookings/${booking_id}`, { key: FAKE_KEYS.studentA });
    at("2026-12-09T05:00:07.000Z");
    await app.request("GET", "/api/v1/bookings", { key: FAKE_KEYS.studentB });
    at("2026-12-09T05:00:08.000Z");
    await app.request("POST", "/api/v1/bookings", { key: FAKE_KEYS.studentB, body: {} });
    at("2026-12-09T05:00:09.000Z");
    await app.request("DELETE", `/api/v1/bookings/${booking_id}`, { key: FAKE_KEYS.studentB });

    const calls = await apiCallsOf(app.db, session.id);

    const A = { studentId: 1234, displayName: "07王小明" };
    const B = { studentId: 1235, displayName: "08李小華" };
    expect(calls).toEqual([
      { at: "2026-12-09T05:00:01.000Z", ...A, action: "listSlots", slotId: null, status: 200, code: null },
      { at: "2026-12-09T05:00:02.000Z", ...A, action: "bookSlot", slotId: A101, status: 201, code: null },
      { at: "2026-12-09T05:00:03.000Z", ...B, action: "bookSlot", slotId: A101, status: 409, code: "SLOT_TAKEN" },
      { at: "2026-12-09T05:00:04.000Z", ...B, action: "bookSlot", slotId: "nonsense", status: 400, code: "INVALID_SLOT" },
      { at: "2026-12-09T05:00:05.000Z", ...B, action: "bookSlot", slotId: A102, status: 201, code: null },
      { at: "2026-12-09T05:00:06.000Z", ...A, action: "cancelBooking", slotId: A102, status: 403, code: "NOT_OWNER" },
      { at: "2026-12-09T05:00:07.000Z", ...B, action: "listMyBookings", slotId: null, status: 200, code: null },
      { at: "2026-12-09T05:00:08.000Z", ...B, action: "bookSlot", slotId: null, status: 400, code: "INVALID_REQUEST" },
      { at: "2026-12-09T05:00:09.000Z", ...B, action: "cancelBooking", slotId: A102, status: 204, code: null },
    ]);
  });

  it("records a cancel of an unknown 預約 as 404 NOT_FOUND without a slot", async () => {
    await app.request("DELETE", "/api/v1/bookings/not-a-uuid", { key: FAKE_KEYS.studentA });

    const [call] = await apiCallsOf(app.db, session.id);
    expect(call).toMatchObject({ action: "cancelBooking", slotId: null, status: 404, code: "NOT_FOUND" });
  });

  it("writes nothing when the class has no 堂課 or the key is refused", async () => {
    await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.otherClass });
    await book(FAKE_KEYS.expired, A101);

    expect(await apiCallsOf(app.db, session.id)).toEqual([]);
  });

  it("keeps each 堂課's log separate", async () => {
    await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentA });
    const next = await createSession(app.db, { classId: 56, name: "下週" });
    await app.request("GET", "/api/v1/bookings", { key: FAKE_KEYS.studentA });

    expect((await apiCallsOf(app.db, session.id)).map((c) => c.action)).toEqual(["listSlots"]);
    expect((await apiCallsOf(app.db, next.id)).map((c) => c.action)).toEqual(["listMyBookings"]);
  });
});

describe("名冊（堂課學生）", () => {
  it("records each student's first call and first successful booking, ordered by first call", async () => {
    at("2026-12-09T05:01:00.000Z");
    await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentB });
    at("2026-12-09T05:02:00.000Z");
    await book(FAKE_KEYS.studentA, "nonsense");
    at("2026-12-09T05:03:00.000Z");
    await book(FAKE_KEYS.studentA, A101);
    at("2026-12-09T05:04:00.000Z");
    await book(FAKE_KEYS.studentB, A101);
    at("2026-12-09T05:05:00.000Z");
    const { booking_id } = await (await book(FAKE_KEYS.studentA, A102)).json();
    await app.request("DELETE", `/api/v1/bookings/${booking_id}`, { key: FAKE_KEYS.studentA });

    expect(await rosterOf(app.db, session.id)).toEqual([
      {
        studentId: 1235,
        displayName: "08李小華",
        firstCallAt: "2026-12-09T05:01:00.000Z",
        firstBookedAt: null,
      },
      {
        studentId: 1234,
        displayName: "07王小明",
        firstCallAt: "2026-12-09T05:02:00.000Z",
        firstBookedAt: "2026-12-09T05:03:00.000Z",
      },
    ]);
  });

  it("updates the 顯示名稱 on every passing Key Check, on the board too", async () => {
    await book(FAKE_KEYS.studentA, A101);
    nameOfA = "07王大明";

    const board = await (await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentA })).json();

    expect(board.slots[0]).toMatchObject({ slot_id: A101, booked_by: "07王大明" });
    expect((await rosterOf(app.db, session.id))[0].displayName).toBe("07王大明");
    const calls = await apiCallsOf(app.db, session.id);
    expect(calls.map((c) => c.displayName)).toEqual(["07王大明", "07王大明"]);
  });

  it("keeps a separate 名冊 per 堂課", async () => {
    await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentA });
    const next = await createSession(app.db, { classId: 56, name: "下週" });

    expect(await rosterOf(app.db, next.id)).toEqual([]);
    await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentB });
    expect((await rosterOf(app.db, next.id)).map((r) => r.studentId)).toEqual([1235]);
  });
});
