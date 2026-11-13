import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RouterGateway } from "@/server/router-gateway";
import { createFakeGateway } from "@/server/router-gateway/fake";
import { addSlots, createSession } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";
import { postgresTestUrl } from "../helpers/postgres-test-db";

/**
 * The booking races against a real Postgres server (several connections at once),
 * which PGlite (one connection, so every request is serialized) cannot show.
 * Opt-in: runs only when TEST_DATABASE_URL is set (see conventions: "Real Postgres").
 */

const N = 20;
const DATE = "2026-12-16";

/** Admits keys `race-<i>` as student 3000+i of class 56. */
const raceGateway: RouterGateway = {
  ...createFakeGateway({}),
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

const book = (app: TestApp, key: string, slotId: string) =>
  app.request("POST", "/api/v1/bookings", { key, body: { slot_id: slotId } });

describe.skipIf(!postgresTestUrl())("real Postgres: simultaneous 預約", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await setupTestApp({ gateway: raceGateway, realPostgres: true });
  });
  afterEach(async () => {
    await app.close();
  });

  it("N students booking the same 可借格 at once: exactly one succeeds, the rest get SLOT_TAKEN", async () => {
    const session = await createSession(app.db, { classId: 56, name: "race" });
    await addSlots(app.db, session.id, [{ date: DATE, start: "12:10", end: "13:00", room: "301" }]);
    const slotId = `${DATE}_12:10-13:00_301`;

    const responses = await Promise.all(Array.from({ length: N }, (_, i) => book(app, `race-${i}`, slotId)));

    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    const refused = responses.filter((r) => r.status !== 201);
    expect(refused).toHaveLength(N - 1);
    for (const r of refused) expect((await r.json()).code).toBe("SLOT_TAKEN");
    const board = await (await app.request("GET", "/api/v1/slots", { key: "race-0" })).json();
    expect(board.slots[0].status).toBe("booked");
  });

  it("one student (每人上限 1) booking several 可借格 at once: exactly one succeeds, the rest get LIMIT_REACHED", async () => {
    const rooms = ["301", "302", "303", "304", "305", "306"];
    const session = await createSession(app.db, { classId: 56, name: "limit race" });
    await addSlots(
      app.db,
      session.id,
      rooms.map((room) => ({ date: DATE, start: "12:10", end: "13:00", room })),
    );

    const responses = await Promise.all(rooms.map((room) => book(app, "race-1", `${DATE}_12:10-13:00_${room}`)));

    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    const refused = responses.filter((r) => r.status !== 201);
    expect(refused).toHaveLength(rooms.length - 1);
    for (const r of refused) expect((await r.json()).code).toBe("LIMIT_REACHED");
    const mine = await (await app.request("GET", "/api/v1/bookings", { key: "race-1" })).json();
    expect(mine.bookings).toHaveLength(1);
  });
});
