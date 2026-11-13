import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Validator } from "@seriousme/openapi-schema-validator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiCallsOf } from "@/server/call-log";
import { FAKE_KEYS } from "@/server/router-gateway/fake";
import { addSlots, createSession } from "@/server/sessions";
import { setupTestApp, type TestApp } from "../helpers/app";

type Json = Record<string, unknown>;
type Operation = {
  operationId: string;
  summary?: string;
  description?: string;
  parameters?: { name: string; in: string; description?: string }[];
  requestBody?: { content: { "application/json": { example?: unknown } } };
  responses: Record<string, unknown>;
};
type Doc = {
  openapi: string;
  servers: { url: string }[];
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Json>; securitySchemes: Record<string, Json> };
  security: Record<string, unknown[]>[];
};

let app: TestApp;

beforeEach(async () => {
  app = await setupTestApp();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await app.close();
});

async function fetchDoc(path = "/api/v1/openapi.json"): Promise<Doc> {
  const res = await app.request("GET", path);
  expect(res.status).toBe(200);
  return (await res.json()) as Doc;
}

const operations = (doc: Doc) =>
  Object.entries(doc.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, op]) => ({ path, method: method.toUpperCase(), op })),
  );

/** Every `route.ts` under src/app/api/v1 except the OpenAPI document itself, as "METHOD /path". */
async function studentRouteFiles(): Promise<string[]> {
  const root = fileURLToPath(new URL("../../src/app/api/v1", import.meta.url));
  const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith("route.ts"));
  const found: string[] = [];
  for (const file of files) {
    const dir = relative(root, join(root, file, "..")).split(sep).join("/");
    if (dir === "openapi.json") continue;
    const path = "/" + dir.replace(/\[(\w+)\]/g, "{$1}");
    const mod = (await import(/* @vite-ignore */ join(root, file))) as Record<string, unknown>;
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      if (typeof mod[method] === "function") found.push(`${method} ${path}`);
    }
  }
  return found.sort();
}

describe("GET /api/v1/openapi.json — 學生專用 OpenAPI", () => {
  it("is a valid OpenAPI 3.0 document", async () => {
    const doc = await fetchDoc();

    expect(doc.openapi).toMatch(/^3\.0\.\d+$/);
    const result = await new Validator().validate(doc as never);
    expect(result.errors ?? []).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("points servers[0] at PUBLIC_BASE_URL + /api/v1", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://club-booking.example.com/");

    const doc = await fetchDoc();

    expect(doc.servers[0].url).toBe("https://club-booking.example.com/api/v1");
  });

  it("falls back to the request's origin when PUBLIC_BASE_URL is not set", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");

    const doc = await fetchDoc("https://preview-123.example.app/api/v1/openapi.json");

    expect(doc.servers[0].url).toBe("https://preview-123.example.app/api/v1");
  });

  it("uses Vercel's production domain when PUBLIC_BASE_URL is not set", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "club-booking.vercel.app");

    const doc = await fetchDoc();

    expect(doc.servers[0].url).toBe("https://club-booking.vercel.app/api/v1");
  });

  it("has exactly the student endpoints, with short-verb operationIds", async () => {
    const doc = await fetchDoc();

    expect(
      operations(doc)
        .map(({ path, method, op }) => `${method} ${path} ${op.operationId}`)
        .sort(),
    ).toEqual([
      "DELETE /bookings/{id} cancelBooking",
      "GET /bookings listMyBookings",
      "GET /slots listSlots",
      "POST /bookings bookSlot",
      "POST /poster/copy writePosterCopy",
    ]);
    expect(
      operations(doc)
        .map(({ path, method }) => `${method} ${path}`)
        .sort(),
    ).toEqual(await studentRouteFiles());
  });

  it("names each operation the way the API 呼叫紀錄 does (operationId = 動作), using its own examples", async () => {
    const doc = await fetchDoc();
    const session = await createSession(app.db, { classId: 56, name: "12/09" });
    await addSlots(app.db, session.id, [
      { date: "2026-12-09", start: "13:00", end: "14:00", room: "A101" },
      { date: "2026-12-09", start: "13:00", end: "14:00", room: "A102" },
    ]);
    const other = await app.request("POST", "/api/v1/bookings", {
      key: FAKE_KEYS.studentA,
      body: { slot_id: "2026-12-09_13:00-14:00_A102" },
    });
    const bookingId = ((await other.json()) as { booking_id: string }).booking_id;

    for (const { path, method, op } of operations(doc)) {
      const example = op.requestBody?.content["application/json"].example;
      const res = await app.request(method, "/api/v1" + path.replace("{id}", bookingId), {
        key: FAKE_KEYS.studentA,
        ...(example === undefined ? {} : { body: example }),
      });
      expect(res.status, `${method} ${path}`).toBeLessThan(300);
      const calls = await apiCallsOf(app.db, session.id);
      expect(calls.at(-1)?.action, `${method} ${path}`).toBe(op.operationId);
    }
  });

  it("declares Bearer auth for every operation", async () => {
    const doc = await fetchDoc();

    const schemes = Object.values(doc.components.securitySchemes);
    expect(schemes).toEqual([expect.objectContaining({ type: "http", scheme: "bearer" })]);
    const name = Object.keys(doc.components.securitySchemes)[0];
    expect(doc.security).toEqual([{ [name]: [] }]);
  });

  it("lists every student error code", async () => {
    const doc = await fetchDoc();

    expect((doc.components.schemas.Error as { properties: { code: { enum: string[] } } }).properties.code.enum.sort()).toEqual(
      [
        "UNAUTHORIZED",
        "NOT_A_STUDENT",
        "BOOKING_CLOSED",
        "ROUTER_UNAVAILABLE",
        "SLOT_TAKEN",
        "INVALID_SLOT",
        "NOT_OWNER",
        "NOT_FOUND",
        "LIMIT_REACHED",
        "INVALID_POSTER",
        "INVALID_REQUEST",
        "INTERNAL_ERROR",
      ].sort(),
    );
  });

  it("describes every operation, parameter and field in Chinese", async () => {
    const doc = await fetchDoc();
    const han = /\p{Script=Han}/u;
    const missing: string[] = [];

    for (const { path, method, op } of operations(doc)) {
      if (!han.test(`${op.summary ?? ""}${op.description ?? ""}`)) missing.push(`${method} ${path}`);
      for (const p of op.parameters ?? []) if (!han.test(p.description ?? "")) missing.push(`${method} ${path} ${p.name}`);
    }
    for (const [name, schema] of Object.entries(doc.components.schemas)) {
      if (!han.test(String(schema.description ?? ""))) missing.push(name);
      const props = (schema.properties ?? {}) as Record<string, { description?: string }>;
      for (const [prop, s] of Object.entries(props)) if (!han.test(s.description ?? "")) missing.push(`${name}.${prop}`);
    }
    expect(missing).toEqual([]);
  });
});
