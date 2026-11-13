import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAKE_KEYS, FAKE_TEACHERS } from "@/server/router-gateway/fake";
import { setupTestApp, type TestApp } from "../helpers/app";
import { teacherCookie } from "../helpers/teacher";

let app: TestApp;
let sessionId: string;

const { teacher, otherTeacher, admin } = FAKE_TEACHERS;
const asTeacher = () => ({ cookies: teacherCookie(app, teacher) });

beforeEach(async () => {
  app = await setupTestApp();
  const res = await app.request("POST", "/api/teacher/classes/56/sessions", {
    ...asTeacher(),
    body: { name: "12/09 社團教室" },
  });
  sessionId = (await res.json()).session.id;
});
afterEach(async () => {
  await app.close();
});

const generate = (body: unknown, id = sessionId, cookies = asTeacher().cookies) =>
  app.request("POST", `/api/teacher/sessions/${id}/slots/generate`, { cookies, body });

const slotIds = async (id = sessionId) => {
  const res = await app.request("GET", `/api/teacher/sessions/${id}`, asTeacher());
  expect(res.status).toBe(200);
  return ((await res.json()).slots as { slot_id: string }[]).map((s) => s.slot_id);
};

const book = async (slotId: string, key: string = FAKE_KEYS.studentA) => {
  const res = await app.request("POST", "/api/v1/bookings", { key, body: { slot_id: slotId } });
  expect(res.status).toBe(201);
};

const twoByTwo = {
  dates: ["2026-12-09", "2026-12-10"],
  times: [{ start: "12:10", end: "13:00" }],
  rooms: ["A101", "A102"],
};

describe("POST /api/teacher/sessions/:id/slots/generate — 批次產生可借格", () => {
  it("previews the count without writing, then adds dates × 時段 × 教室", async () => {
    const preview = await generate({ ...twoByTwo, preview: true });
    expect(preview.status).toBe(200);
    expect(await preview.json()).toEqual({ requested: 4, added: 4, skipped: 0 });
    expect(await slotIds()).toEqual([]);

    const res = await generate(twoByTwo);

    expect(await res.json()).toEqual({ requested: 4, added: 4, skipped: 0 });
    expect(await slotIds()).toEqual([
      "2026-12-09_12:10-13:00_A101",
      "2026-12-09_12:10-13:00_A102",
      "2026-12-10_12:10-13:00_A101",
      "2026-12-10_12:10-13:00_A102",
    ]);
  });

  it("skips 可借格 the 堂課 already has, in the preview too", async () => {
    await generate({ dates: ["2026-12-09"], times: [{ start: "12:10", end: "13:00" }], rooms: ["A101"] });

    expect(await (await generate({ ...twoByTwo, preview: true })).json()).toEqual({
      requested: 4,
      added: 3,
      skipped: 1,
    });
    expect(await (await generate(twoByTwo)).json()).toEqual({ requested: 4, added: 3, skipped: 1 });
    expect(await slotIds()).toHaveLength(4);
  });

  it("answers 400 INVALID_REQUEST for bad dates, 時段, or 教室", async () => {
    const bad = [
      { ...twoByTwo, dates: ["2026-02-30"] },
      { ...twoByTwo, dates: [] },
      { ...twoByTwo, times: [{ start: "13:00", end: "12:10" }] },
      { ...twoByTwo, times: [{ start: "9:00", end: "10:00" }] },
      { ...twoByTwo, rooms: ["  "] },
      { ...twoByTwo, rooms: "A101" },
    ];
    for (const body of bad) {
      const res = await generate(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).code).toBe("INVALID_REQUEST");
    }
    expect(await slotIds()).toEqual([]);
  });

  it("is refused for another teacher's 堂課 (403), allowed for an admin, 404 for an unknown 堂課", async () => {
    const other = await generate(twoByTwo, sessionId, teacherCookie(app, otherTeacher));
    expect(other.status).toBe(403);
    expect((await other.json()).code).toBe("FORBIDDEN");

    expect((await generate(twoByTwo, sessionId, teacherCookie(app, admin))).status).toBe(200);

    const unknown = await generate(twoByTwo, "00000000-0000-4000-8000-000000000000");
    expect(unknown.status).toBe(404);
    expect((await generate(twoByTwo, "not-a-uuid")).status).toBe(404);
  });
});

describe("DELETE /api/teacher/sessions/:id/slots/:slotId — 移除單格", () => {
  beforeEach(async () => {
    await generate(twoByTwo);
  });

  it("removes an open 可借格", async () => {
    const res = await app.request(
      "DELETE",
      `/api/teacher/sessions/${sessionId}/slots/${encodeURIComponent("2026-12-09_12:10-13:00_A101")}`,
      asTeacher(),
    );

    expect(res.status).toBe(204);
    expect(await slotIds()).not.toContain("2026-12-09_12:10-13:00_A101");
  });

  it("refuses a 已借 可借格 with 409 CONFLICT and keeps it and its 預約", async () => {
    await book("2026-12-09_12:10-13:00_A101");

    const res = await app.request(
      "DELETE",
      `/api/teacher/sessions/${sessionId}/slots/${encodeURIComponent("2026-12-09_12:10-13:00_A101")}`,
      asTeacher(),
    );

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CONFLICT");
    const mine = await app.request("GET", "/api/v1/bookings", { key: FAKE_KEYS.studentA });
    expect((await mine.json()).bookings).toMatchObject([{ slot_id: "2026-12-09_12:10-13:00_A101" }]);
  });

  it("answers 404 NOT_FOUND for a 可借格 the 堂課 does not have, 403 for another teacher", async () => {
    const path = `/api/teacher/sessions/${sessionId}/slots/2026-12-31_12:10-13:00_A101`;
    const res = await app.request("DELETE", path, asTeacher());
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");

    const other = await app.request("DELETE", `/api/teacher/sessions/${sessionId}/slots/2026-12-09_12:10-13:00_A101`, {
      cookies: teacherCookie(app, otherTeacher),
    });
    expect(other.status).toBe(403);
  });
});

describe("PUT /api/teacher/sessions/:id/slots — 整批覆寫", () => {
  beforeEach(async () => {
    await generate(twoByTwo);
  });

  const slot = (date: string, room: string) => ({ date, start: "12:10", end: "13:00", room });

  it("replaces the 可借清單 (drops the ones not given, adds new ones)", async () => {
    const res = await app.request("PUT", `/api/teacher/sessions/${sessionId}/slots`, {
      ...asTeacher(),
      body: { slots: [slot("2026-12-09", "A101"), slot("2026-12-11", "B201")] },
    });

    expect(res.status).toBe(200);
    expect(await slotIds()).toEqual(["2026-12-09_12:10-13:00_A101", "2026-12-11_12:10-13:00_B201"]);
  });

  it("answers 409 CONFLICT when it would drop a 已借 可借格, and changes nothing", async () => {
    await book("2026-12-10_12:10-13:00_A102", FAKE_KEYS.studentB);
    const before = await slotIds();

    const res = await app.request("PUT", `/api/teacher/sessions/${sessionId}/slots`, {
      ...asTeacher(),
      body: { slots: [slot("2026-12-09", "A101"), slot("2026-12-11", "B201")] },
    });

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CONFLICT");
    expect(await slotIds()).toEqual(before);
    const board = await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentA });
    expect((await board.json()).slots).toContainEqual(
      expect.objectContaining({ slot_id: "2026-12-10_12:10-13:00_A102", status: "booked", booked_by: "08李小華" }),
    );
  });

  it("keeps a 已借 可借格 that is still in the new list", async () => {
    await book("2026-12-09_12:10-13:00_A101");

    const res = await app.request("PUT", `/api/teacher/sessions/${sessionId}/slots`, {
      ...asTeacher(),
      body: { slots: [slot("2026-12-09", "A101")] },
    });

    expect(res.status).toBe(200);
    expect(await slotIds()).toEqual(["2026-12-09_12:10-13:00_A101"]);
  });

  it("answers 400 INVALID_REQUEST for a malformed list, 403 for another teacher", async () => {
    for (const body of [{}, { slots: [{ date: "x", start: "12:10", end: "13:00", room: "A" }] }]) {
      const res = await app.request("PUT", `/api/teacher/sessions/${sessionId}/slots`, { ...asTeacher(), body });
      expect(res.status).toBe(400);
    }
    const other = await app.request("PUT", `/api/teacher/sessions/${sessionId}/slots`, {
      cookies: teacherCookie(app, otherTeacher),
      body: { slots: [] },
    });
    expect(other.status).toBe(403);
  });
});
