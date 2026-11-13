import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAKE_KEYS } from "@/server/router-gateway/fake";
import { addSlots, createSession, type Session } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";

let app: TestApp;
let session: Session;

const A101 = "2026-12-09_13:00-14:00_A101";
const A102 = "2026-12-09_13:00-14:00_A102";

beforeEach(async () => {
  app = await setupTestApp();
  session = await createSession(app.db, { classId: 56, name: "12/09 社團教室" });
  await addSlots(app.db, session.id, [
    { date: "2026-12-09", start: "13:00", end: "14:00", room: "A101" },
    { date: "2026-12-09", start: "13:00", end: "14:00", room: "A102" },
  ]);
});
afterEach(async () => {
  await app.close();
});

const book = (key: string, slotId: unknown) =>
  app.request("POST", "/api/v1/bookings", { key, body: { slot_id: slotId } });

async function boardSlot(slotId: string) {
  const res = await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentA });
  const body = await res.json();
  return body.slots.find((s: { slot_id: string }) => s.slot_id === slotId);
}

describe("POST /api/v1/bookings — 預約", () => {
  it("books an open 可借格 with 201 and the board shows the student's 顯示名稱", async () => {
    const res = await book(FAKE_KEYS.studentA, A101);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      slot_id: A101,
      date: "2026-12-09",
      start: "13:00",
      end: "14:00",
      room: "A101",
    });
    expect(typeof body.booking_id).toBe("string");
    expect(await boardSlot(A101)).toMatchObject({ status: "booked", booked_by: "07王小明" });
  });

  it("refuses an already-booked 可借格 with 409 SLOT_TAKEN and keeps the first booker", async () => {
    await book(FAKE_KEYS.studentA, A101);

    const res = await book(FAKE_KEYS.studentB, A101);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SLOT_TAKEN");
    expect(body.message).toEqual(expect.any(String));
    expect(await boardSlot(A101)).toMatchObject({ booked_by: "07王小明" });
  });

  it.each([
    ["unknown", "2026-12-09_15:00-16:00_A101"],
    ["malformed", "A101 下午"],
    ["empty", ""],
  ])("refuses an %s slot_id with 400 INVALID_SLOT", async (_, slotId) => {
    const res = await book(FAKE_KEYS.studentA, slotId);

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SLOT");
  });

  it("refuses a 可借格 of another class's 堂課 with 400 INVALID_SLOT", async () => {
    const other = await createSession(app.db, { classId: 57, name: "57 班" });
    await addSlots(app.db, other.id, [
      { date: "2026-12-10", start: "09:00", end: "10:00", room: "C301" },
    ]);

    const res = await book(FAKE_KEYS.studentA, "2026-12-10_09:00-10:00_C301");

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SLOT");
  });

  it.each([
    ["no slot_id", {}],
    ["a non-string slot_id", { slot_id: 42 }],
    ["not an object", "A101"],
  ])("refuses a body with %s with 400 INVALID_REQUEST", async (_, body) => {
    const res = await app.request("POST", "/api/v1/bookings", { key: FAKE_KEYS.studentA, body });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_REQUEST");
  });

  it("refuses with 403 BOOKING_CLOSED when the class has no 堂課", async () => {
    const res = await book(FAKE_KEYS.otherClass, A101);

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("BOOKING_CLOSED");
  });

  it("refuses with 401 UNAUTHORIZED when no key is sent", async () => {
    const res = await app.request("POST", "/api/v1/bookings", { body: { slot_id: A101 } });

    expect(res.status).toBe(401);
  });

  it("refuses a body that is not JSON with 400 INVALID_REQUEST", async () => {
    const res = await app.request("POST", "/api/v1/bookings", {
      key: FAKE_KEYS.studentA,
      headers: { "content-type": "application/json" },
      rawBody: "{slot_id:",
    });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_REQUEST");
  });
});

describe("GET /api/v1/bookings — 我的預約", () => {
  it("lists only the calling student's 預約 in the 目前堂課", async () => {
    const mine = await (await book(FAKE_KEYS.studentA, A102)).json();
    await book(FAKE_KEYS.studentB, A101);

    const res = await app.request("GET", "/api/v1/bookings", { key: FAKE_KEYS.studentA });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      session: { id: session.id, name: "12/09 社團教室" },
      bookings: [
        {
          booking_id: mine.booking_id,
          slot_id: A102,
          date: "2026-12-09",
          start: "13:00",
          end: "14:00",
          room: "A102",
          booked_at: mine.booked_at,
        },
      ],
    });
  });

  it("does not list 預約 of an earlier 堂課", async () => {
    await book(FAKE_KEYS.studentA, A101);
    await createSession(app.db, { classId: 56, name: "下週" });

    const res = await app.request("GET", "/api/v1/bookings", { key: FAKE_KEYS.studentA });

    expect((await res.json()).bookings).toEqual([]);
  });
});

describe("DELETE /api/v1/bookings/:id — 取消我的預約", () => {
  const cancel = (key: string, bookingId: string) =>
    app.request("DELETE", `/api/v1/bookings/${encodeURIComponent(bookingId)}`, { key });

  it("cancels the student's own 預約 with 204 and the 可借格 opens again", async () => {
    const { booking_id } = await (await book(FAKE_KEYS.studentA, A101)).json();

    const res = await cancel(FAKE_KEYS.studentA, booking_id);

    expect(res.status).toBe(204);
    expect(await boardSlot(A101)).toMatchObject({ status: "open" });
    const mine = await app.request("GET", "/api/v1/bookings", { key: FAKE_KEYS.studentA });
    expect((await mine.json()).bookings).toEqual([]);
    expect((await book(FAKE_KEYS.studentB, A101)).status).toBe(201);
  });

  it("refuses to cancel someone else's 預約 with 403 NOT_OWNER and keeps it", async () => {
    const { booking_id } = await (await book(FAKE_KEYS.studentA, A101)).json();

    const res = await cancel(FAKE_KEYS.studentB, booking_id);

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NOT_OWNER");
    expect(await boardSlot(A101)).toMatchObject({ status: "booked", booked_by: "07王小明" });
  });

  it.each([
    ["an unknown booking id", "00000000-0000-4000-8000-000000000000"],
    ["a malformed booking id", "not-a-uuid"],
  ])("answers 404 NOT_FOUND for %s", async (_, bookingId) => {
    const res = await cancel(FAKE_KEYS.studentA, bookingId);

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("answers 404 NOT_FOUND for a 預約 already cancelled", async () => {
    const { booking_id } = await (await book(FAKE_KEYS.studentA, A101)).json();
    await cancel(FAKE_KEYS.studentA, booking_id);

    const res = await cancel(FAKE_KEYS.studentA, booking_id);

    expect(res.status).toBe(404);
  });

  it("answers 404 NOT_FOUND for a 預約 of an earlier 堂課", async () => {
    const { booking_id } = await (await book(FAKE_KEYS.studentA, A101)).json();
    await createSession(app.db, { classId: 56, name: "下週" });

    const res = await cancel(FAKE_KEYS.studentA, booking_id);

    expect(res.status).toBe(404);
  });
});
