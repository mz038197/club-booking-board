import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAKE_KEYS, FAKE_TEACHERS } from "@/server/router-gateway/fake";
import type { Teacher } from "@/server/router-gateway";
import { addSlots, createSession, type Session } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";
import { teacherCookie } from "../helpers/teacher";

let app: TestApp;
let session: Session;

const { teacher, otherTeacher } = FAKE_TEACHERS;

const A101 = "2026-12-16_12:10-13:00_A101";
const POSTER = { title: "吉他社迎新", body: "歡迎大家來吉他社玩，自備撥片，現場有老師帶大家彈第一首歌！" };

beforeEach(async () => {
  app = await setupTestApp();
  session = await createSession(app.db, { classId: 56, name: "12/16 第一堂" });
  await addSlots(app.db, session.id, [{ date: "2026-12-16", start: "12:10", end: "13:00", room: "A101" }]);
});
afterEach(async () => {
  await app.close();
});

/** studentA books A101 and pins a 海報 on it; returns the booking id. */
async function bookWithPoster(): Promise<string> {
  const booked = await app.request("POST", "/api/v1/bookings", { key: FAKE_KEYS.studentA, body: { slot_id: A101 } });
  expect(booked.status).toBe(201);
  const bookingId = ((await booked.json()) as { booking_id: string }).booking_id;
  const pinned = await app.request("POST", `/api/v1/bookings/${bookingId}/poster`, {
    key: FAKE_KEYS.studentA,
    body: POSTER,
  });
  expect(pinned.status).toBe(200);
  return bookingId;
}

const deletePoster = (slotId: string, who: Teacher = teacher, sessionId = session.id) =>
  app.request("DELETE", `/api/teacher/sessions/${sessionId}/slots/${encodeURIComponent(slotId)}/poster`, {
    cookies: teacherCookie(app, who),
  });

async function monitorSlot(slotId: string) {
  const res = await app.request("GET", `/api/teacher/sessions/${session.id}/monitor`, {
    cookies: teacherCookie(app, teacher),
  });
  expect(res.status).toBe(200);
  return ((await res.json()).slots as Record<string, unknown>[]).find((s) => s.slot_id === slotId);
}

async function myBookingIds(key: string = FAKE_KEYS.studentA) {
  const res = await app.request("GET", "/api/v1/bookings", { key });
  expect(res.status).toBe(200);
  return ((await res.json()).bookings as { booking_id: string }[]).map((b) => b.booking_id);
}

describe("DELETE /api/teacher/sessions/:id/slots/:slotId/poster — 老師刪除海報", () => {
  it("takes the 海報 off the 日展開, while the 預約 stays", async () => {
    const bookingId = await bookWithPoster();
    expect(await monitorSlot(A101)).toMatchObject({ poster: POSTER });

    const res = await deletePoster(A101);

    expect(res.status).toBe(204);
    const slot = await monitorSlot(A101);
    expect(slot).toMatchObject({ status: "booked", booked_by: "07王小明" });
    expect(slot).not.toHaveProperty("poster");
    expect(await myBookingIds()).toEqual([bookingId]);
  });

  it("leaves the 預約 usable: the student can pin a new 海報 on it", async () => {
    const bookingId = await bookWithPoster();
    await deletePoster(A101);

    const again = { title: "吉他社第二版", body: "改過的海報內容，歡迎大家下課後來 A101 一起彈吉他喔！" };
    const res = await app.request("POST", `/api/v1/bookings/${bookingId}/poster`, {
      key: FAKE_KEYS.studentA,
      body: again,
    });

    expect(res.status).toBe(200);
    expect(await monitorSlot(A101)).toMatchObject({ poster: again });
  });

  it("refuses a teacher who does not own the 堂課's 班級, and the 海報 stays", async () => {
    await bookWithPoster();

    const res = await deletePoster(A101, otherTeacher);

    expect(res.status).toBe(403);
    expect(await monitorSlot(A101)).toMatchObject({ poster: POSTER });
  });

  it("answers 404 NOT_FOUND for a 預約 without a 海報", async () => {
    const booked = await app.request("POST", "/api/v1/bookings", { key: FAKE_KEYS.studentA, body: { slot_id: A101 } });
    expect(booked.status).toBe(201);

    const res = await deletePoster(A101);

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("answers 404 NOT_FOUND for an open or unknown 可借格", async () => {
    expect((await deletePoster(A101)).status).toBe(404);
    expect((await deletePoster("2026-12-16_12:10-13:00_Z999")).status).toBe(404);
  });

  it("only reaches 海報 in the 堂課 named in the path", async () => {
    await bookWithPoster();
    const other = await createSession(app.db, { classId: 56, name: "12/16 第二堂" });

    const res = await deletePoster(A101, teacher, other.id);

    expect(res.status).toBe(404);
    expect(await monitorSlot(A101)).toMatchObject({ poster: POSTER });
  });
});

describe("教師操作紀錄", () => {
  it("records who deleted which 海報", async () => {
    await bookWithPoster();
    await deletePoster(A101);

    const res = await app.request("GET", `/api/teacher/sessions/${session.id}/admin-log`, {
      cookies: teacherCookie(app, teacher),
    });
    const [latest] = (await res.json()).entries as {
      action: string;
      message: string;
      teacher: { display_name: string };
    }[];

    expect(latest.action).toBe("deletePoster");
    expect(latest.teacher.display_name).toBe(teacher.displayName);
    expect(latest.message).toContain(A101);
    expect(latest.message).toContain("07王小明");
    expect(latest.message).toContain(POSTER.title);
  });

  it("does not record a refused delete", async () => {
    await deletePoster(A101);

    const res = await app.request("GET", `/api/teacher/sessions/${session.id}/admin-log`, {
      cookies: teacherCookie(app, teacher),
    });
    const entries = (await res.json()).entries as { action: string }[];

    expect(entries.map((e) => e.action)).not.toContain("deletePoster");
  });
});
