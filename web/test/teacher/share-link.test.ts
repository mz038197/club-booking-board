import { afterEach, describe, expect, it } from "vitest";
import { FAKE_KEYS, FAKE_TEACHERS } from "@/server/router-gateway/fake";
import type { Teacher } from "@/server/router-gateway";
import { addSlots, createSession } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";
import { teacherCookie } from "../helpers/teacher";

let app: TestApp;

afterEach(async () => {
  await app.close();
});

const { teacher } = FAKE_TEACHERS;
const SLOT_301 = "2026-12-16_12:10-13:00_301";

/** 班級 56 (林老師) with a 目前堂課 of two 可借格. */
async function classWithSession(name = "12/16 第一堂") {
  const session = await createSession(app.db, { classId: 56, name });
  await addSlots(app.db, session.id, [
    { date: "2026-12-16", start: "12:10", end: "13:00", room: "301" },
    { date: "2026-12-16", start: "12:10", end: "13:00", room: "302" },
  ]);
  return session;
}

function asTeacher(method: string, path: string, who: Teacher = teacher) {
  return app.request(method, path, { cookies: teacherCookie(app, who) });
}

async function generate(sessionId: string): Promise<{ token: string; url: string; expires_at: string }> {
  const res = await asTeacher("POST", `/api/teacher/sessions/${sessionId}/share-link`);
  expect(res.status).toBe(201);
  return (await res.json()).share_link;
}

describe("學生分享連結 — 拿到連結就能看", () => {
  it("shows the 堂課's board with full 顯示名稱 to anyone holding the link, without login", async () => {
    app = await setupTestApp();
    const session = await classWithSession();
    await app.request("PATCH", `/api/teacher/sessions/${session.id}/display-settings`, {
      cookies: teacherCookie(app, teacher),
      body: { mask_names: true },
    });
    await app.request("POST", "/api/v1/bookings", { key: FAKE_KEYS.studentA, body: { slot_id: SLOT_301 } });

    const link = await generate(session.id);
    const res = await app.request("GET", `/api/share/${link.token}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session).toEqual({ id: session.id, name: "12/16 第一堂" });
    expect(body.slots).toHaveLength(2);
    expect(body.slots.find((s: { slot_id: string }) => s.slot_id === SLOT_301)).toMatchObject({
      status: "booked",
      booked_by: "07王小明",
    });
    expect(body).not.toHaveProperty("roster");
    expect(body).not.toHaveProperty("calls");
  });
});

describe("學生分享連結 — 失效", () => {
  it("stops working 12 hours after it was made, and the admin shows the remaining time until then", async () => {
    let clock = new Date("2026-12-16T03:00:00Z");
    app = await setupTestApp({ now: () => clock });
    const session = await classWithSession();

    const link = await generate(session.id);
    expect(link.expires_at).toBe("2026-12-16T15:00:00.000Z");

    clock = new Date("2026-12-16T14:59:59Z");
    expect((await app.request("GET", `/api/share/${link.token}`)).status).toBe(200);
    const status = await asTeacher("GET", `/api/teacher/sessions/${session.id}/share-link`);
    expect((await status.json()).share_link).toEqual({
      created_at: "2026-12-16T03:00:00.000Z",
      expires_at: "2026-12-16T15:00:00.000Z",
    });

    clock = new Date("2026-12-16T15:00:00Z");
    const res = await app.request("GET", `/api/share/${link.token}`);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
    const after = await asTeacher("GET", `/api/teacher/sessions/${session.id}/share-link`);
    expect((await after.json()).share_link).toBeNull();
  });

  it("kills the old link at once when the teacher regenerates it", async () => {
    app = await setupTestApp();
    const session = await classWithSession();

    const old = await generate(session.id);
    const fresh = await generate(session.id);

    expect(fresh.token).not.toBe(old.token);
    expect((await app.request("GET", `/api/share/${old.token}`)).status).toBe(404);
    expect((await app.request("GET", `/api/share/${fresh.token}`)).status).toBe(200);
  });

  it("kills the link at once when the teacher closes it", async () => {
    app = await setupTestApp();
    const session = await classWithSession();
    const link = await generate(session.id);

    const res = await asTeacher("DELETE", `/api/teacher/sessions/${session.id}/share-link`);

    expect(res.status).toBe(204);
    expect((await app.request("GET", `/api/share/${link.token}`)).status).toBe(404);
    const status = await asTeacher("GET", `/api/teacher/sessions/${session.id}/share-link`);
    expect((await status.json()).share_link).toBeNull();
  });

  it("answers 404 for made-up tokens", async () => {
    app = await setupTestApp();
    await classWithSession();

    for (const token of ["x", "A".repeat(43), "not a token at all"]) {
      const res = await app.request("GET", `/api/share/${encodeURIComponent(token)}`);
      expect(res.status).toBe(404);
    }
  });

  it("keeps one 堂課's link separate from another's", async () => {
    app = await setupTestApp();
    const first = await classWithSession("第一堂");
    const firstLink = await generate(first.id);
    const second = await classWithSession("第二堂"); // becomes 目前堂課

    await generate(second.id);

    const res = await app.request("GET", `/api/share/${firstLink.token}`);
    expect(res.status).toBe(200);
    expect((await res.json()).session.name).toBe("第一堂");
  });
});

describe("學生分享連結 — 唯讀", () => {
  it("offers no write method on the share endpoint", async () => {
    const mod: Record<string, unknown> = await import("@/app/api/share/[token]/route");
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) expect(mod[method]).toBeUndefined();
  });

  it("does not let the link holder act as a teacher", async () => {
    app = await setupTestApp();
    const session = await classWithSession();
    const link = await generate(session.id);

    const res = await app.request("POST", `/api/teacher/sessions/${session.id}/share-link`, {
      headers: { authorization: `Bearer ${link.token}` },
    });

    expect(res.status).toBe(401);
  });
});

describe("學生分享連結 — 教師後台", () => {
  it("needs a teacher login and the 班級", async () => {
    app = await setupTestApp();
    const session = await classWithSession();
    const path = `/api/teacher/sessions/${session.id}/share-link`;

    for (const method of ["GET", "POST", "DELETE"]) {
      expect((await app.request(method, path)).status).toBe(401);
      const res = await asTeacher(method, path, FAKE_TEACHERS.otherTeacher);
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("FORBIDDEN");
    }
    expect((await asTeacher("POST", path, FAKE_TEACHERS.admin)).status).toBe(201);
  });

  it("answers 404 for an unknown 堂課", async () => {
    app = await setupTestApp();

    const res = await asTeacher("POST", "/api/teacher/sessions/00000000-0000-4000-8000-000000000000/share-link");

    expect(res.status).toBe(404);
  });

  it("only makes links for the 目前堂課", async () => {
    app = await setupTestApp();
    const old = await classWithSession("舊堂課");
    await classWithSession("新堂課");

    const res = await asTeacher("POST", `/api/teacher/sessions/${old.id}/share-link`);

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CONFLICT");
  });

  it("hands out a share URL on this site", async () => {
    app = await setupTestApp();
    const session = await classWithSession();

    const link = await generate(session.id);

    expect(link.url).toBe(`http://localhost/share/${link.token}`);
    expect(link.token.length).toBeGreaterThanOrEqual(43);
  });

  it("never stores the token itself", async () => {
    app = await setupTestApp();
    const session = await classWithSession();
    const link = await generate(session.id);

    // Whole-database scan, independent of the table layout (the AC is about storage).
    const tables = await app.db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    expect(tables.length).toBeGreaterThan(0);
    for (const { table_name } of tables) {
      const rows = await app.db.query(`SELECT * FROM "${table_name}"`);
      expect(JSON.stringify(rows)).not.toContain(link.token);
    }
  });
});
