import { afterEach, beforeEach, expect, it } from "vitest";
import type { RouterGateway } from "@/server/router-gateway";
import { addSlots, createSession } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";

// Port of v1 backend/tests/test_concurrent_booking.py.

const N = 20;
const SLOT_ID = "2026-09-25_13:00-15:00_301";

/** Admits keys `race-<i>` as student 3000+i of class 56. */
const raceGateway: RouterGateway = {
  async checkStudentKey(key) {
    const match = key?.match(/^race-(\d+)$/);
    if (!match) return { ok: false, reason: "invalid", message: "無效的 API 金鑰" };
    const i = Number(match[1]);
    return {
      ok: true,
      student: { studentId: 3000 + i, classId: 56, classSessionId: 789, displayName: `學生${i}` },
    };
  },
};

let app: TestApp;

beforeEach(async () => {
  app = await setupTestApp({ gateway: raceGateway });
});
afterEach(async () => {
  await app.close();
});

it("lets exactly one of N simultaneous bookings of the same 可借格 succeed; the rest get SLOT_TAKEN", async () => {
  const session = await createSession(app.db, { classId: 56, name: "race" });
  await addSlots(app.db, session.id, [
    { date: "2026-09-25", start: "13:00", end: "15:00", room: "301" },
  ]);

  const responses = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      app.request("POST", "/api/v1/bookings", { key: `race-${i}`, body: { slot_id: SLOT_ID } }),
    ),
  );

  const successes = responses.filter((r) => r.status === 201);
  const taken = responses.filter((r) => r.status === 409);
  expect(successes).toHaveLength(1);
  expect(taken).toHaveLength(N - 1);
  for (const r of taken) expect((await r.json()).code).toBe("SLOT_TAKEN");

  const board = await (await app.request("GET", "/api/v1/slots", { key: "race-0" })).json();
  expect(board.slots[0].status).toBe("booked");
});
