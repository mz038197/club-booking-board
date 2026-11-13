import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Teacher } from "@/server/router-gateway";
import { FAKE_KEYS, FAKE_TEACHERS } from "@/server/router-gateway/fake";
import { setupTestApp, type TestApp } from "../helpers/app";
import { teacherCookie } from "../helpers/teacher";

// 後台上課模式 (#20): 統計、預約與強制取消、名冊、教師操作紀錄、重置堂課.

const A101 = "2026-12-09_13:00-14:00_A101";
const A102 = "2026-12-09_13:00-14:00_A102";
const B201 = "2026-12-09_14:00-15:00_B201";

let app: TestApp;
let sessionId: string;
let clock: Date;

const { teacher, otherTeacher, admin } = FAKE_TEACHERS;
const as = (t: Teacher = teacher) => ({ cookies: teacherCookie(app, t) });
const at = (iso: string) => {
  clock = new Date(iso);
};

beforeEach(async () => {
  clock = new Date("2026-12-09T04:00:00.000Z");
  app = await setupTestApp({ now: () => clock });
  const res = await app.request("POST", "/api/teacher/classes/56/sessions", {
    ...as(),
    body: { name: "12/09 社團教室" },
  });
  sessionId = (await res.json()).session.id;
  await app.request("POST", `/api/teacher/sessions/${sessionId}/slots/generate`, {
    ...as(),
    body: {
      dates: ["2026-12-09"],
      times: [{ start: "13:00", end: "14:00" }],
      rooms: ["A101", "A102"],
    },
  });
  await app.request("POST", `/api/teacher/sessions/${sessionId}/slots/generate`, {
    ...as(),
    body: { dates: ["2026-12-09"], times: [{ start: "14:00", end: "15:00" }], rooms: ["B201"] },
  });
  // Students here book more than one 可借格.
  await app.request("PUT", `/api/teacher/sessions/${sessionId}/rules`, {
    ...as(),
    body: { per_student_limit: 3, booking_window: null },
  });
});
afterEach(async () => {
  await app.close();
});

const book = async (key: string, slotId: string) => {
  const res = await app.request("POST", "/api/v1/bookings", { key, body: { slot_id: slotId } });
  expect(res.status).toBe(201);
  return (await res.json()).booking_id as string;
};
const get = async (path: string, t: Teacher = teacher) => {
  const res = await app.request("GET", `/api/teacher/sessions/${sessionId}${path}`, as(t));
  expect(res.status).toBe(200);
  return res.json();
};

describe("GET /api/teacher/sessions/:id/stats — 統計", () => {
  it("counts 可借格, 已借, students who called and students who booked", async () => {
    expect(await get("/stats")).toEqual({
      slot_count: 3,
      booked_count: 0,
      called_students: 0,
      booked_students: 0,
    });

    await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentB });
    await book(FAKE_KEYS.studentA, A101);
    await book(FAKE_KEYS.studentA, A102);

    expect(await get("/stats")).toEqual({
      slot_count: 3,
      booked_count: 2,
      called_students: 2,
      booked_students: 1,
    });
  });
});

describe("GET /api/teacher/sessions/:id/roster — 名冊", () => {
  it("lists only students who have called, by first call, with how many 可借格 each holds", async () => {
    expect(await get("/roster")).toEqual({ students: [] });

    at("2026-12-09T05:01:00.000Z");
    await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentB });
    at("2026-12-09T05:02:00.000Z");
    await book(FAKE_KEYS.studentA, A101);
    at("2026-12-09T05:03:00.000Z");
    await book(FAKE_KEYS.studentA, B201);

    expect(await get("/roster")).toEqual({
      students: [
        {
          student_id: 1235,
          display_name: "08李小華",
          first_call_at: "2026-12-09T05:01:00.000Z",
          first_booked_at: null,
          booked_count: 0,
        },
        {
          student_id: 1234,
          display_name: "07王小明",
          first_call_at: "2026-12-09T05:02:00.000Z",
          first_booked_at: "2026-12-09T05:02:00.000Z",
          booked_count: 2,
        },
      ],
    });
  });
});

describe("預約列表與強制取消", () => {
  it("lists every 預約 of the 堂課 in board order with the student", async () => {
    at("2026-12-09T05:01:00.000Z");
    const b = await book(FAKE_KEYS.studentB, B201);
    at("2026-12-09T05:02:00.000Z");
    const a = await book(FAKE_KEYS.studentA, A101);

    expect(await get("/bookings")).toEqual({
      bookings: [
        {
          booking_id: a,
          slot_id: A101,
          date: "2026-12-09",
          start: "13:00",
          end: "14:00",
          room: "A101",
          booked_at: "2026-12-09T05:02:00.000Z",
          student_id: 1234,
          display_name: "07王小明",
        },
        {
          booking_id: b,
          slot_id: B201,
          date: "2026-12-09",
          start: "14:00",
          end: "15:00",
          room: "B201",
          booked_at: "2026-12-09T05:01:00.000Z",
          student_id: 1235,
          display_name: "08李小華",
        },
      ],
    });
  });

  it("force-cancels any student's 預約: the 可借格 is 可借 again and gone from the student's 我的預約", async () => {
    const a = await book(FAKE_KEYS.studentA, A101);
    await book(FAKE_KEYS.studentA, A102);

    const res = await app.request("DELETE", `/api/teacher/sessions/${sessionId}/bookings/${a}`, as());

    expect(res.status).toBe(204);
    const detail = await get("");
    expect(detail.slots.find((s: { slot_id: string }) => s.slot_id === A101)).toEqual({
      slot_id: A101,
      date: "2026-12-09",
      start: "13:00",
      end: "14:00",
      room: "A101",
      status: "open",
    });
    const mine = await app.request("GET", "/api/v1/bookings", { key: FAKE_KEYS.studentA });
    expect((await mine.json()).bookings.map((x: { slot_id: string }) => x.slot_id)).toEqual([A102]);
    // The 可借格 can be booked again.
    await book(FAKE_KEYS.studentB, A101);
  });

  it("answers 404 NOT_FOUND for an unknown 預約 or one of another 堂課", async () => {
    const a = await book(FAKE_KEYS.studentA, A101);
    const other = await app.request("POST", "/api/teacher/classes/56/sessions", {
      ...as(),
      body: { name: "下週" },
    });
    const otherId = (await other.json()).session.id;

    for (const path of [
      `/api/teacher/sessions/${sessionId}/bookings/not-a-uuid`,
      `/api/teacher/sessions/${sessionId}/bookings/00000000-0000-4000-8000-000000000000`,
      `/api/teacher/sessions/${otherId}/bookings/${a}`,
    ]) {
      const res = await app.request("DELETE", path, as());
      expect(res.status).toBe(404);
      expect((await res.json()).code).toBe("NOT_FOUND");
    }
    expect((await get("/bookings")).bookings).toHaveLength(1);
  });
});

describe("GET /api/teacher/sessions/:id/admin-log — 教師操作紀錄", () => {
  const actions = async (id = sessionId) =>
    ((await (await app.request("GET", `/api/teacher/sessions/${id}/admin-log`, as())).json()).entries as {
      action: string;
    }[]).map((e) => e.action);

  it("records the teacher, time, action and a message for a force-cancel, newest first", async () => {
    const a = await book(FAKE_KEYS.studentA, A101);
    at("2026-12-09T05:10:00.000Z");
    await app.request("DELETE", `/api/teacher/sessions/${sessionId}/bookings/${a}`, as(admin));

    const { entries } = await get("/admin-log");

    expect(entries[0]).toEqual({
      at: "2026-12-09T05:10:00.000Z",
      teacher: { user_id: 1, display_name: "系統管理員" },
      action: "forceCancel",
      message: `強制取消 07王小明 的預約 ${A101}`,
    });
  });

  it("records the 課前準備 actions: create 堂課, 可借清單 changes, set 目前堂課", async () => {
    await app.request("DELETE", `/api/teacher/sessions/${sessionId}/slots/${encodeURIComponent(B201)}`, as());
    await app.request("PUT", `/api/teacher/sessions/${sessionId}/slots`, {
      ...as(),
      body: { slots: [{ date: "2026-12-09", start: "13:00", end: "14:00", room: "A101" }] },
    });
    await app.request("POST", `/api/teacher/sessions/${sessionId}/current`, as());

    expect(await actions()).toEqual([
      "makeCurrent",
      "replaceSlots",
      "removeSlot",
      "setRules",
      "generateSlots",
      "generateSlots",
      "createSession",
    ]);
  });

  it("records 投影顯示 changes", async () => {
    await app.request("PATCH", `/api/teacher/sessions/${sessionId}/display-settings`, {
      ...as(),
      body: { mask_names: true },
    });

    expect((await get("/admin-log")).entries[0]).toMatchObject({
      action: "displaySettings",
      message: "投影：遮蔽名稱、不自動跳日",
    });
  });

  it("records 暫停／恢復 and 預約規則 changes", async () => {
    const put = (path: string, body: unknown) =>
      app.request("PUT", `/api/teacher/sessions/${sessionId}${path}`, { ...as(), body });
    await put("/rules", { per_student_limit: 2, booking_window: { start: "12:00", end: "13:30" } });
    await put("/pause", { paused: true });
    await put("/pause", { paused: false });

    const messages = (await get("/admin-log")).entries.slice(0, 3).map((e: { message: string }) => e.message);
    expect(messages).toEqual([
      "已恢復預約",
      "已暫停預約：學生 Agent 預約／取消會收到 403 BOOKING_CLOSED，查詢照常",
      "規則：每人最多 2 格，12:00–13:30 可預約",
    ]);
  });

  it("records 產生／重新產生／關閉 分享連結", async () => {
    const url = `/api/teacher/sessions/${sessionId}/share-link`;
    await app.request("POST", url, as());
    await app.request("POST", url, as());
    await app.request("DELETE", url, as());

    const messages = (await get("/admin-log")).entries.slice(0, 3).map((e: { message: string }) => e.message);
    expect(messages).toEqual([
      "已關閉分享連結",
      "已重新產生分享連結：舊連結立即失效",
      "已產生分享連結（12 小時後失效）",
    ]);
  });

  it("does not record previews or refused actions", async () => {
    await book(FAKE_KEYS.studentA, A101);
    await app.request("POST", `/api/teacher/sessions/${sessionId}/slots/generate`, {
      ...as(),
      body: { dates: ["2026-12-10"], times: [{ start: "13:00", end: "14:00" }], rooms: ["A101"], preview: true },
    });
    const refused = await app.request(
      "DELETE",
      `/api/teacher/sessions/${sessionId}/slots/${encodeURIComponent(A101)}`,
      as(),
    );
    expect(refused.status).toBe(409);

    expect(await actions()).toEqual(["setRules", "generateSlots", "generateSlots", "createSession"]);
  });

  it("keeps each 堂課's log separate", async () => {
    const res = await app.request("POST", "/api/teacher/classes/56/sessions", {
      ...as(),
      body: { name: "下週", copy_from: sessionId },
    });
    const next = (await res.json()).session.id;

    expect(await actions(next)).toEqual(["createSession"]);
    expect(await actions()).toEqual(["setRules", "generateSlots", "generateSlots", "createSession"]);
  });
});

describe("POST /api/teacher/sessions/:id/reset — 重置堂課", () => {
  it("clears 預約 and the API 呼叫紀錄, keeps 可借清單, 預約規則 and 名冊", async () => {
    at("2026-12-09T05:01:00.000Z");
    await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentB });
    at("2026-12-09T05:02:00.000Z");
    await book(FAKE_KEYS.studentA, A101);
    await book(FAKE_KEYS.studentA, A102);
    expect((await get("/api-calls")).calls).toHaveLength(3);

    at("2026-12-09T05:10:00.000Z");
    const res = await app.request("POST", `/api/teacher/sessions/${sessionId}/reset`, as());

    expect(res.status).toBe(204);
    expect((await get("/bookings")).bookings).toEqual([]);
    expect((await get("/api-calls")).calls).toEqual([]);
    const detail = await get("");
    expect(detail.slots.map((s: { slot_id: string; status: string }) => [s.slot_id, s.status])).toEqual([
      [A101, "open"],
      [A102, "open"],
      [B201, "open"],
    ]);
    expect(detail.session.per_student_limit).toBe(3);
    expect(await get("/roster")).toEqual({
      students: [
        {
          student_id: 1235,
          display_name: "08李小華",
          first_call_at: "2026-12-09T05:01:00.000Z",
          first_booked_at: null,
          booked_count: 0,
        },
        {
          student_id: 1234,
          display_name: "07王小明",
          first_call_at: "2026-12-09T05:02:00.000Z",
          first_booked_at: null,
          booked_count: 0,
        },
      ],
    });
    expect(await get("/stats")).toEqual({
      slot_count: 3,
      booked_count: 0,
      called_students: 2,
      booked_students: 0,
    });
    expect((await get("/admin-log")).entries[0]).toMatchObject({
      at: "2026-12-09T05:10:00.000Z",
      action: "resetSession",
    });
  });

  it("keeps 暫停 and the 預約規則", async () => {
    const rules = { per_student_limit: 2, booking_window: { start: "12:00", end: "13:30" } };
    await app.request("PUT", `/api/teacher/sessions/${sessionId}/rules`, { ...as(), body: rules });
    await app.request("PUT", `/api/teacher/sessions/${sessionId}/pause`, { ...as(), body: { paused: true } });

    await app.request("POST", `/api/teacher/sessions/${sessionId}/reset`, as());

    expect((await get("")).session).toMatchObject({ paused: true, ...rules });
  });

  it("starts recording again after a reset (a rehearsal, then the real class)", async () => {
    await book(FAKE_KEYS.studentA, A101);
    await app.request("POST", `/api/teacher/sessions/${sessionId}/reset`, as());

    at("2026-12-09T06:00:00.000Z");
    await book(FAKE_KEYS.studentB, A101);

    expect((await get("/api-calls")).calls).toEqual([
      {
        at: "2026-12-09T06:00:00.000Z",
        student_id: 1235,
        display_name: "08李小華",
        action: "bookSlot",
        slot_id: A101,
        status: 201,
        code: null,
      },
    ]);
    const roster = (await get("/roster")).students;
    expect(roster.map((r: { student_id: number; first_booked_at: string | null }) => [r.student_id, r.first_booked_at])).toEqual([
      [1234, null],
      [1235, "2026-12-09T06:00:00.000Z"],
    ]);
  });
});

describe("上課模式 endpoints — 教師授權", () => {
  const paths = ["/stats", "/roster", "/bookings", "/api-calls", "/admin-log"];

  it("answers 401 without login, 403 FORBIDDEN for another teacher's 班級, and lets an admin in", async () => {
    const a = await book(FAKE_KEYS.studentA, A101);
    for (const p of paths) {
      const url = `/api/teacher/sessions/${sessionId}${p}`;
      expect((await app.request("GET", url)).status).toBe(401);
      const forbidden = await app.request("GET", url, as(otherTeacher));
      expect(forbidden.status).toBe(403);
      expect((await forbidden.json()).code).toBe("FORBIDDEN");
      expect((await app.request("GET", url, as(admin))).status).toBe(200);
    }
    for (const [method, p] of [
      ["DELETE", `/bookings/${a}`],
      ["POST", "/reset"],
    ]) {
      const url = `/api/teacher/sessions/${sessionId}${p}`;
      expect((await app.request(method, url)).status).toBe(401);
      expect((await app.request(method, url, as(otherTeacher))).status).toBe(403);
    }
    expect((await get("/bookings")).bookings).toHaveLength(1);
  });
});
