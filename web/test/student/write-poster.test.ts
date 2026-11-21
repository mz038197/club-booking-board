import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAKE_KEYS, FAKE_TEACHERS } from "@/server/router-gateway/fake";
import { apiCallsOf } from "@/server/call-log";
import { addSlots, createSession, setPaused, type Session } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";
import { teacherCookie } from "../helpers/teacher";

let app: TestApp;
let session: Session;

const A101 = "2026-12-09_13:00-14:00_A101";

beforeEach(async () => {
  app = await setupTestApp();
  session = await createSession(app.db, { classId: 56, name: "12/09 社團教室" });
  await addSlots(app.db, session.id, [{ date: "2026-12-09", start: "13:00", end: "14:00", room: "A101" }]);
});
afterEach(async () => {
  await app.close();
});

async function bookA101(key: string = FAKE_KEYS.studentA): Promise<string> {
  const res = await app.request("POST", "/api/v1/bookings", { key, body: { slot_id: A101 } });
  expect(res.status).toBe(201);
  return ((await res.json()) as { booking_id: string }).booking_id;
}

const writePoster = (bookingId: string, body: unknown, key: string = FAKE_KEYS.studentA) =>
  app.request("POST", `/api/v1/bookings/${bookingId}/poster`, { key, body });

const POSTER = { title: "吉他社迎新", body: "歡迎大家來吉他社玩，自備撥片，現場有老師帶大家彈第一首歌！" };

describe("POST /api/v1/bookings/:id/poster — write_poster 貼海報", () => {
  it("pins the poster on my 預約, with 日期、時段、教室 taken from the 預約", async () => {
    const bookingId = await bookA101();

    const res = await writePoster(bookingId, POSTER);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      booking_id: bookingId,
      title: POSTER.title,
      body: POSTER.body,
      date: "2026-12-09",
      start: "13:00",
      end: "14:00",
      room: "A101",
    });
  });

  it("refuses someone else's 預約 with 403 NOT_OWNER", async () => {
    const bookingId = await bookA101(FAKE_KEYS.studentA);

    const res = await writePoster(bookingId, POSTER, FAKE_KEYS.studentB);

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NOT_OWNER");
  });

  it("answers 404 NOT_FOUND for a 預約 that does not exist", async () => {
    for (const id of ["00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
      const res = await writePoster(id, POSTER);
      expect(res.status).toBe(404);
      expect((await res.json()).code).toBe("NOT_FOUND");
    }
  });

  it("is refused with 403 BOOKING_CLOSED while the 堂課 is 暫停, saying 海報 cannot be written now", async () => {
    const bookingId = await bookA101();
    await setPaused(app.db, session.id, true);

    const res = await writePoster(bookingId, POSTER);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("BOOKING_CLOSED");
    expect(body.message).toContain("海報");
  });

  it("is written to the API 呼叫紀錄 as writePoster with the 預約's 可借格", async () => {
    const bookingId = await bookA101();

    await writePoster(bookingId, POSTER);

    const calls = await apiCallsOf(app.db, session.id);
    expect(calls.map((c) => [c.action, c.slotId, c.status])).toContainEqual(["writePoster", A101, 200]);
  });
});

/** The 可借格 as the teacher's 監看 (月曆監看 日展開) sees it. */
async function monitorSlot(slotId: string = A101) {
  const res = await app.request("GET", `/api/teacher/sessions/${session.id}/monitor`, {
    cookies: teacherCookie(app, FAKE_TEACHERS.teacher),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  return body.slots.find((s: { slot_id: string }) => s.slot_id === slotId);
}

describe("海報 on the teacher's 看板 (日展開)", () => {
  it("shows the 海報 on its 可借格", async () => {
    const bookingId = await bookA101();

    await writePoster(bookingId, POSTER);

    expect(await monitorSlot()).toMatchObject({
      status: "booked",
      booked_by: "07王小明",
      poster: { title: POSTER.title, body: POSTER.body },
    });
  });

  it("keeps only the latest 海報 when the student writes again", async () => {
    const bookingId = await bookA101();
    await writePoster(bookingId, POSTER);

    const res = await writePoster(bookingId, { title: "吉他社迎新 第二版", body: "改版後的內文" });

    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("吉他社迎新 第二版");
    expect((await monitorSlot()).poster).toEqual({ title: "吉他社迎新 第二版", body: "改版後的內文" });
  });

  it("has no 海報 on a 可借格 nobody wrote one for", async () => {
    await bookA101();

    expect(await monitorSlot()).not.toHaveProperty("poster");
  });

  it("is not in the student's listSlots", async () => {
    const bookingId = await bookA101();
    await writePoster(bookingId, POSTER);

    const res = await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentA });
    const slot = (await res.json()).slots.find((s: { slot_id: string }) => s.slot_id === A101);

    expect(slot).toMatchObject({ status: "booked" });
    expect(slot).not.toHaveProperty("poster");
  });

  it("goes away when the student cancels the 預約, so the next booker starts clean", async () => {
    const bookingId = await bookA101(FAKE_KEYS.studentA);
    await writePoster(bookingId, POSTER);

    await app.request("DELETE", `/api/v1/bookings/${bookingId}`, { key: FAKE_KEYS.studentA });
    await bookA101(FAKE_KEYS.studentB);

    expect(await monitorSlot()).toMatchObject({ booked_by: "08李小華" });
    expect(await monitorSlot()).not.toHaveProperty("poster");
  });

  it("goes away when the teacher 強制取消 the 預約", async () => {
    const bookingId = await bookA101();
    await writePoster(bookingId, POSTER);

    const res = await app.request("DELETE", `/api/teacher/sessions/${session.id}/bookings/${bookingId}`, {
      cookies: teacherCookie(app, FAKE_TEACHERS.teacher),
    });
    expect(res.status).toBe(204);
    await bookA101();

    expect(await monitorSlot()).not.toHaveProperty("poster");
  });

  it("goes away when the teacher 重置堂課", async () => {
    const bookingId = await bookA101();
    await writePoster(bookingId, POSTER);

    const res = await app.request("POST", `/api/teacher/sessions/${session.id}/reset`, {
      cookies: teacherCookie(app, FAKE_TEACHERS.teacher),
    });
    expect(res.status).toBeLessThan(300);
    await bookA101();

    expect(await monitorSlot()).not.toHaveProperty("poster");
  });
});
