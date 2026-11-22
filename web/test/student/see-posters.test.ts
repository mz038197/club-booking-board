import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAKE_KEYS } from "@/server/router-gateway/fake";
import { addSlots, createSession, setBookingRules, type Session } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";

let app: TestApp;
let session: Session;

const A101 = "2026-12-09_13:00-14:00_A101";
const A102 = "2026-12-09_13:00-14:00_A102";
const POSTER = { title: "吉他社迎新", body: "歡迎大家來吉他社玩，自備撥片，現場有老師帶大家彈第一首歌！" };

beforeEach(async () => {
  app = await setupTestApp();
  session = await createSession(app.db, { classId: 56, name: "12/09 社團教室" });
  await addSlots(app.db, session.id, [
    { date: "2026-12-09", start: "13:00", end: "14:00", room: "A101" },
    { date: "2026-12-09", start: "13:00", end: "14:00", room: "A102" },
  ]);
  await setBookingRules(app.db, session.id, { perStudentLimit: 2 });
});
afterEach(async () => {
  await app.close();
});

async function book(slotId: string, key: string = FAKE_KEYS.studentA): Promise<string> {
  const res = await app.request("POST", "/api/v1/bookings", { key, body: { slot_id: slotId } });
  expect(res.status).toBe(201);
  return ((await res.json()) as { booking_id: string }).booking_id;
}

async function writePoster(bookingId: string, poster = POSTER, key: string = FAKE_KEYS.studentA) {
  const res = await app.request("POST", `/api/v1/bookings/${bookingId}/poster`, { key, body: poster });
  expect(res.status).toBe(200);
}

describe("GET /api/v1/bookings — 查自己的預約附上海報", () => {
  it("attaches each 預約's 海報, and poster: null on a 預約 without one", async () => {
    const withPoster = await book(A101);
    const without = await book(A102);
    await writePoster(withPoster);

    const res = await app.request("GET", "/api/v1/bookings", { key: FAKE_KEYS.studentA });

    expect(res.status).toBe(200);
    const { bookings } = (await res.json()) as { bookings: { booking_id: string; poster: unknown }[] };
    expect(bookings.find((b) => b.booking_id === withPoster)?.poster).toEqual(POSTER);
    const bare = bookings.find((b) => b.booking_id === without);
    expect(bare).toHaveProperty("poster", null);
  });

  it("shows the latest 海報 after 再貼", async () => {
    const bookingId = await book(A101);
    await writePoster(bookingId);
    const v2 = { title: "吉他社迎新 第二版", body: "改版囉！歡迎大家來吉他社玩，現場有老師帶大家彈第一首歌。" };
    await writePoster(bookingId, v2);

    const res = await app.request("GET", "/api/v1/bookings", { key: FAKE_KEYS.studentA });

    expect((await res.json()).bookings[0].poster).toEqual(v2);
  });
});

describe("OpenAPI — listMyBookings 的海報", () => {
  type Schema = {
    $ref?: string;
    allOf?: Schema[];
    required?: string[];
    nullable?: boolean;
    properties?: Record<string, Schema>;
    items?: Schema;
  };

  it("documents a required, nullable poster { title, body } on each of my 預約, and none on Slot", async () => {
    const doc = (await (await app.request("GET", "/api/v1/openapi.json")).json()) as {
      paths: Record<string, Record<string, { responses: Record<string, { content: Record<string, { schema: Schema }> }> }>>;
      components: { schemas: Record<string, Schema> };
    };
    const schemas = doc.components.schemas;
    const deref = (s: Schema): Schema => (s.$ref ? deref(schemas[s.$ref.split("/").pop()!]) : s);
    /** Flattens allOf into one object schema. */
    const flat = (s: Schema): Schema => {
      const d = deref(s);
      const parts = [d, ...(d.allOf ?? []).map(flat)];
      return {
        required: parts.flatMap((p) => p.required ?? []),
        properties: Object.assign({}, ...parts.map((p) => p.properties ?? {})),
      };
    };

    const res = deref(doc.paths["/bookings"].get.responses["200"].content["application/json"].schema);
    const booking = flat(res.properties!.bookings.items!);

    expect(booking.required).toContain("poster");
    const poster = booking.properties!.poster;
    expect(poster.nullable).toBe(true);
    expect(flat(poster).required).toEqual(expect.arrayContaining(["title", "body"]));
    expect(flat(schemas.Slot).properties).not.toHaveProperty("poster");
  });
});

describe("GET /api/v1/slots — 查可借格不含海報", () => {
  it("never carries a 海報, even on a 預約 that has one", async () => {
    const bookingId = await book(A101);
    await writePoster(bookingId);

    const res = await app.request("GET", "/api/v1/slots", { key: FAKE_KEYS.studentB });

    expect(res.status).toBe(200);
    const { slots } = (await res.json()) as { slots: Record<string, unknown>[] };
    expect(slots.find((s) => s.slot_id === A101)).toMatchObject({ status: "booked", booked_by: "07王小明" });
    for (const slot of slots) expect(slot).not.toHaveProperty("poster");
    expect(JSON.stringify(slots)).not.toContain(POSTER.title);
  });
});
