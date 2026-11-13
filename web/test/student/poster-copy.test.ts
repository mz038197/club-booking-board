import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiCallsOf } from "@/server/call-log";
import { FAKE_KEYS } from "@/server/router-gateway/fake";
import { createSession } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";

let app: TestApp;

beforeEach(async () => {
  app = await setupTestApp();
});
afterEach(async () => {
  await app.close();
});

const PATH = "/api/v1/poster/copy";

describe("POST /api/v1/poster/copy — 海報文案 (v1 port)", () => {
  it("writes title, time-place, slogan and body from the event details, text only", async () => {
    await createSession(app.db, { classId: 56, name: "12/09" });

    const res = await app.request("POST", PATH, {
      key: FAKE_KEYS.studentA,
      body: { title: "吉他社迎新", time: "9/25 13:00-15:00", place: "301教室", notes: "自備撥片" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      title: "吉他社迎新",
      time_place: "9/25 13:00-15:00 @ 301教室",
      slogan: "一起來！吉他社迎新",
      body: "歡迎參加「吉他社迎新」！時間地點：9/25 13:00-15:00，301教室。備註：自備撥片",
    });
  });

  it("leaves the 備註 out of the body when there are no notes", async () => {
    await createSession(app.db, { classId: 56, name: "12/09" });

    const res = await app.request("POST", PATH, {
      key: FAKE_KEYS.studentA,
      body: { title: "桌遊社", time: "12/9 12:10", place: "A101", notes: "  " },
    });

    expect(res.status).toBe(200);
    expect((await res.json()).body).toBe("歡迎參加「桌遊社」！時間地點：12/9 12:10，A101。");
  });

  it.each([
    ["a missing title", { time: "9/25", place: "301" }],
    ["a blank place", { title: "迎新", time: "9/25", place: " " }],
    ["a non-string time", { title: "迎新", time: 925, place: "301" }],
    ["non-string notes", { title: "迎新", time: "9/25", place: "301", notes: 1 }],
  ])("answers 400 INVALID_POSTER for %s", async (_, body) => {
    await createSession(app.db, { classId: 56, name: "12/09" });

    const res = await app.request("POST", PATH, { key: FAKE_KEYS.studentA, body });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_POSTER");
  });

  it("answers 400 INVALID_POSTER for a body that is not JSON", async () => {
    await createSession(app.db, { classId: 56, name: "12/09" });

    const res = await app.request("POST", PATH, { key: FAKE_KEYS.studentA, rawBody: "title=迎新" });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_POSTER");
  });

  it("needs a classroom key", async () => {
    const res = await app.request("POST", PATH, { body: { title: "迎新", time: "9/25", place: "301" } });

    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
  });

  it("is written to the API 呼叫紀錄 as writePosterCopy, failures too", async () => {
    const session = await createSession(app.db, { classId: 56, name: "12/09" });

    await app.request("POST", PATH, { key: FAKE_KEYS.studentA, body: { title: "迎新", time: "9/25", place: "301" } });
    await app.request("POST", PATH, { key: FAKE_KEYS.studentA, body: { title: "迎新" } });

    const calls = await apiCallsOf(app.db, session.id);
    expect(calls.map((c) => [c.action, c.status, c.code])).toEqual([
      ["writePosterCopy", 200, null],
      ["writePosterCopy", 400, "INVALID_POSTER"],
    ]);
  });
});
