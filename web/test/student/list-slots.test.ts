import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAKE_KEYS, FAKE_NOTICES } from "@/server/router-gateway/fake";
import { createSession, addSlots } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";
import { seedBooking } from "../helpers/seed";

let app: TestApp;

beforeEach(async () => {
  app = await setupTestApp();
});
afterEach(async () => {
  await app.close();
});

const slot = (date: string, start: string, end: string, room: string) => ({ date, start, end, room });

describe("GET /api/v1/slots — 列出目前堂課的可借格", () => {
  it("gives a student the 可借格 of their class's 目前堂課, with the 顯示名稱 of whoever booked", async () => {
    const session = await createSession(app.db, { classId: 56, name: "12/09 社團教室" });
    await addSlots(app.db, session.id, [
      slot("2026-12-09", "13:00", "14:00", "A101"),
      slot("2026-12-09", "13:00", "14:00", "A102"),
      slot("2026-12-08", "10:00", "11:00", "B201"),
    ]);
    await seedBooking(app.db, {
      sessionId: session.id,
      slotId: "2026-12-09_13:00-14:00_A102",
      studentId: 1235,
      displayName: "08李小華",
    });

    const res = await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentA });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      session: { id: session.id, name: "12/09 社團教室" },
      slots: [
        {
          slot_id: "2026-12-08_10:00-11:00_B201",
          date: "2026-12-08",
          start: "10:00",
          end: "11:00",
          room: "B201",
          status: "open",
        },
        {
          slot_id: "2026-12-09_13:00-14:00_A101",
          date: "2026-12-09",
          start: "13:00",
          end: "14:00",
          room: "A101",
          status: "open",
        },
        {
          slot_id: "2026-12-09_13:00-14:00_A102",
          date: "2026-12-09",
          start: "13:00",
          end: "14:00",
          room: "A102",
          status: "booked",
          booked_by: "08李小華",
        },
      ],
    });
  });

  it("enters the newest 堂課 of the class, which becomes the 目前堂課", async () => {
    const older = await createSession(app.db, { classId: 56, name: "上週" });
    await addSlots(app.db, older.id, [slot("2026-12-02", "13:00", "14:00", "A101")]);
    const newer = await createSession(app.db, { classId: 56, name: "本週" });
    await addSlots(app.db, newer.id, [slot("2026-12-09", "13:00", "14:00", "A101")]);

    const res = await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentA });

    const body = await res.json();
    expect(body.session).toEqual({ id: newer.id, name: "本週" });
    expect(body.slots.map((s: { slot_id: string }) => s.slot_id)).toEqual([
      "2026-12-09_13:00-14:00_A101",
    ]);
  });

  it("does not show another class's 堂課 to a student of a different class", async () => {
    const session = await createSession(app.db, { classId: 56, name: "56 班" });
    await addSlots(app.db, session.id, [slot("2026-12-09", "13:00", "14:00", "A101")]);
    const other = await createSession(app.db, { classId: 57, name: "57 班" });
    await addSlots(app.db, other.id, [slot("2026-12-10", "09:00", "10:00", "C301")]);

    const res = await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.otherClass });

    const body = await res.json();
    expect(body.session.name).toBe("57 班");
    expect(body.slots.map((s: { slot_id: string }) => s.slot_id)).toEqual([
      "2026-12-10_09:00-10:00_C301",
    ]);
  });

  it("refuses with 403 BOOKING_CLOSED when the class has no 堂課", async () => {
    const session = await createSession(app.db, { classId: 56, name: "56 班" });
    await addSlots(app.db, session.id, [slot("2026-12-09", "13:00", "14:00", "A101")]);

    const res = await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.otherClass });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("BOOKING_CLOSED");
    expect(body.message).toContain("尚無堂課");
  });

  it("refuses with 401 UNAUTHORIZED when no key is sent", async () => {
    const res = await app.request("GET", "/api/v1/slots");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "UNAUTHORIZED", message: "無效的 API 金鑰" });
  });

  it("refuses a non-Bearer Authorization header with 401", async () => {
    const res = await app.request("GET", "/api/v1/slots", {
      headers: { authorization: `Basic ${FAKE_KEYS.studentA}` },
    });

    expect(res.status).toBe(401);
  });

  it.each([
    ["invalid", "vcr_sk_unknown_key", "無效的 API 金鑰"],
    ["disabled", FAKE_KEYS.disabled, FAKE_NOTICES.disabled],
    ["not started", FAKE_KEYS.notStarted, FAKE_NOTICES.notStarted],
    ["expired", FAKE_KEYS.expired, FAKE_NOTICES.expired],
  ])("refuses a %s key with 401 UNAUTHORIZED carrying the router's message", async (_, key, message) => {
    await createSession(app.db, { classId: 56, name: "56 班" });

    const res = await app.request("GET", "/api/v1/slots", { key });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "UNAUTHORIZED", message });
  });

  it("refuses a Personal API Key with 403 NOT_A_STUDENT", async () => {
    await createSession(app.db, { classId: 56, name: "56 班" });

    const res = await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.personal });

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NOT_A_STUDENT");
  });

  it("answers 503 ROUTER_UNAVAILABLE when the router cannot answer", async () => {
    await createSession(app.db, { classId: 56, name: "56 班" });

    const res = await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.unavailable });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("ROUTER_UNAVAILABLE");
    expect(typeof body.message).toBe("string");
  });
});
