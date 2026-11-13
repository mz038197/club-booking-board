import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RouterGateway } from "@/server/router-gateway";
import { createFakeGateway, FAKE_KEYS, FAKE_TEACHERS } from "@/server/router-gateway/fake";
import { addSlots, createSession, type Session } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";
import { teacherCookie } from "../helpers/teacher";

// 預約規則 (每人上限、時間窗) and 暫停, as the student's Agent sees them.

/** Taipei is UTC+8: 13:00 Taipei = 05:00Z. */
const taipei = (hhmm: string) => new Date(`2026-12-09T${hhmm}:00+08:00`);

let clock = taipei("13:00");
let app: TestApp;
let session: Session;

const A101 = "2026-12-09_13:00-14:00_A101";
const A102 = "2026-12-09_13:00-14:00_A102";
const A103 = "2026-12-09_13:00-14:00_A103";

async function start(gateway?: RouterGateway) {
  app = await setupTestApp({ gateway, now: () => clock });
  session = await createSession(app.db, { classId: 56, name: "12/09 社團教室" });
  await addSlots(
    app.db,
    session.id,
    ["A101", "A102", "A103"].map((room) => ({ date: "2026-12-09", start: "13:00", end: "14:00", room })),
  );
}

beforeEach(() => {
  clock = taipei("13:00");
});
afterEach(async () => {
  await app.close();
});

const asTeacher = () => ({ cookies: teacherCookie(app, FAKE_TEACHERS.teacher) });

const book = (key: string, slotId: string) =>
  app.request("POST", "/api/v1/bookings", { key, body: { slot_id: slotId } });

async function setRules(rules: Record<string, unknown>) {
  const res = await app.request("PUT", `/api/teacher/sessions/${session.id}/rules`, {
    ...asTeacher(),
    body: rules,
  });
  expect(res.status).toBe(200);
  return res.json();
}

async function setPaused(paused: boolean) {
  const res = await app.request("PUT", `/api/teacher/sessions/${session.id}/pause`, {
    ...asTeacher(),
    body: { paused },
  });
  expect(res.status).toBe(200);
  return res.json();
}

async function myBookings(key = FAKE_KEYS.studentA) {
  const res = await app.request("GET", "/api/v1/bookings", { key });
  expect(res.status).toBe(200);
  return (await res.json()).bookings as { booking_id: string; slot_id: string }[];
}

describe("每人上限", () => {
  beforeEach(() => start());

  it("defaults to 1: a second 預約 gets 409 LIMIT_REACHED and is not written", async () => {
    expect((await book(FAKE_KEYS.studentA, A101)).status).toBe(201);

    const res = await book(FAKE_KEYS.studentA, A102);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("LIMIT_REACHED");
    expect(body.message).toContain("1");
    expect((await myBookings()).map((b) => b.slot_id)).toEqual([A101]);
  });

  it("follows the teacher's 每人上限, per student", async () => {
    await setRules({ per_student_limit: 2, booking_window: null });

    expect((await book(FAKE_KEYS.studentA, A101)).status).toBe(201);
    expect((await book(FAKE_KEYS.studentA, A102)).status).toBe(201);
    expect((await book(FAKE_KEYS.studentA, A103)).status).toBe(409);
    expect((await book(FAKE_KEYS.studentB, A103)).status).toBe(201);
  });

  it("frees a place again after the student cancels", async () => {
    const first = await (await book(FAKE_KEYS.studentA, A101)).json();
    await app.request("DELETE", `/api/v1/bookings/${first.booking_id}`, { key: FAKE_KEYS.studentA });

    expect((await book(FAKE_KEYS.studentA, A102)).status).toBe(201);
  });
});

describe("每人上限 under concurrency", () => {
  it("never lets one student exceed the limit with simultaneous 預約", async () => {
    await start();
    await setRules({ per_student_limit: 2, booking_window: null });
    const rooms = ["B1", "B2", "B3", "B4", "B5", "B6"];
    await addSlots(
      app.db,
      session.id,
      rooms.map((room) => ({ date: "2026-12-09", start: "13:00", end: "14:00", room })),
    );

    const responses = await Promise.all(
      rooms.map((room) => book(FAKE_KEYS.studentA, `2026-12-09_13:00-14:00_${room}`)),
    );

    expect(responses.filter((r) => r.status === 201)).toHaveLength(2);
    const refused = responses.filter((r) => r.status !== 201);
    expect(refused).toHaveLength(4);
    for (const r of refused) expect((await r.json()).code).toBe("LIMIT_REACHED");
    expect(await myBookings()).toHaveLength(2);
  });
});

describe("暫停", () => {
  beforeEach(() => start());

  it("refuses 預約 and 取消 with 403 BOOKING_CLOSED saying the teacher paused; queries still work", async () => {
    const booked = await (await book(FAKE_KEYS.studentA, A101)).json();
    await setPaused(true);

    const bookRes = await book(FAKE_KEYS.studentB, A102);
    expect(bookRes.status).toBe(403);
    const bookBody = await bookRes.json();
    expect(bookBody.code).toBe("BOOKING_CLOSED");
    expect(bookBody.message).toContain("暫停");

    const cancelRes = await app.request("DELETE", `/api/v1/bookings/${booked.booking_id}`, {
      key: FAKE_KEYS.studentA,
    });
    expect(cancelRes.status).toBe(403);
    expect((await cancelRes.json()).message).toContain("暫停");

    expect((await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentB })).status).toBe(200);
    expect((await myBookings()).map((b) => b.slot_id)).toEqual([A101]);
  });

  it("lets 預約 through again after 恢復", async () => {
    expect(await setPaused(true)).toEqual({ paused: true });
    expect(await setPaused(false)).toEqual({ paused: false });

    expect((await book(FAKE_KEYS.studentA, A101)).status).toBe(201);
  });
});

describe("時間窗", () => {
  beforeEach(() => start());

  it("refuses 預約 before the window with BOOKING_CLOSED saying when it opens", async () => {
    await setRules({ per_student_limit: 1, booking_window: { start: "12:30", end: "15:10" } });
    clock = taipei("12:29");

    const res = await book(FAKE_KEYS.studentA, A101);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("BOOKING_CLOSED");
    expect(body.message).toContain("12:30");
    expect((await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentA })).status).toBe(200);
  });

  it("allows 預約 and 取消 inside the window (start inclusive, end exclusive)", async () => {
    await setRules({ per_student_limit: 1, booking_window: { start: "12:30", end: "15:10" } });
    clock = taipei("12:30");
    const booked = await (await book(FAKE_KEYS.studentA, A101)).json();
    expect(booked.slot_id).toBe(A101);

    clock = taipei("15:09");
    const cancel = await app.request("DELETE", `/api/v1/bookings/${booked.booking_id}`, {
      key: FAKE_KEYS.studentA,
    });
    expect(cancel.status).toBe(204);
  });

  it("refuses 取消 after the window with a message naming the window", async () => {
    await setRules({ per_student_limit: 1, booking_window: { start: "12:30", end: "15:10" } });
    const booked = await (await book(FAKE_KEYS.studentA, A101)).json();
    clock = taipei("15:10");

    const res = await app.request("DELETE", `/api/v1/bookings/${booked.booking_id}`, {
      key: FAKE_KEYS.studentA,
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("BOOKING_CLOSED");
    expect(body.message).toContain("12:30–15:10");
    expect(await myBookings()).toHaveLength(1);
  });

  it("has no window by default", async () => {
    clock = taipei("03:00");
    expect((await book(FAKE_KEYS.studentA, A101)).status).toBe(201);
  });
});

describe("三種 BOOKING_CLOSED", () => {
  it("have distinguishable messages (無堂課, 暫停, 時間窗)", async () => {
    await start();
    const noSession = await (
      await app.request("POST", "/api/v1/bookings", { key: FAKE_KEYS.otherClass, body: { slot_id: A101 } })
    ).json();

    await setRules({ per_student_limit: 1, booking_window: { start: "14:00", end: "15:00" } });
    const window = await (await book(FAKE_KEYS.studentA, A101)).json();

    await setPaused(true);
    const paused = await (await book(FAKE_KEYS.studentA, A101)).json();

    const messages = [noSession, window, paused].map((b) => {
      expect(b.code).toBe("BOOKING_CLOSED");
      return b.message;
    });
    expect(new Set(messages).size).toBe(3);
  });
});

describe("可借格 removed by the teacher while a student books it", () => {
  it("answers 400 INVALID_SLOT, not 500", async () => {
    // Simulate the race: the teacher's 移除 commits after the student's slot
    // lookup but before the 預約 is inserted.
    await start(createFakeGateway({}));
    const db = app.deps.db;
    const racingDb = (inner: typeof db): typeof db => ({
      exec: (sql) => inner.exec(sql),
      close: () => inner.close(),
      async query<T>(sql: string, params?: unknown[]) {
        if (/INSERT INTO bookings/.test(sql)) {
          await inner.query(`DELETE FROM slots WHERE session_id = $1 AND slot_id = $2`, [session.id, A101]);
        }
        return inner.query<T>(sql, params);
      },
      transaction: (fn) => inner.transaction((tx) => fn(racingDb(tx))),
    });
    app.deps.db = racingDb(db);

    const res = await book(FAKE_KEYS.studentA, A101);

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SLOT");
  });
});
