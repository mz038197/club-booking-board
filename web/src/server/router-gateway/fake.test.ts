import { describe, expect, it } from "vitest";
import { FAKE_KEYS, createFakeGateway } from "./fake";
import { gatewayFromEnv } from "./index";

describe("fake router gateway", () => {
  it("answers the fixed student keys", async () => {
    const gateway = createFakeGateway({});
    expect(await gateway.checkStudentKey(FAKE_KEYS.studentA)).toMatchObject({
      ok: true,
      student: { studentId: 1234, classId: 56, displayName: "07王小明" },
    });
    expect(await gateway.checkStudentKey("vcr_sk_whatever")).toMatchObject({
      ok: false,
      reason: "invalid",
    });
  });

  it.each([
    { VERCEL_ENV: "production" },
    { NODE_ENV: "production" },
    { NODE_ENV: "production", VERCEL_ENV: "production" },
  ])("refuses to start in production (%o)", (env) => {
    expect(() => createFakeGateway(env)).toThrow(/production/);
    expect(() => gatewayFromEnv({ ...env, ROUTER_GATEWAY: "fake" })).toThrow(/production/);
  });

  it("may run on a Vercel preview deployment", () => {
    expect(() =>
      createFakeGateway({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    ).not.toThrow();
  });

  it("is chosen only when ROUTER_GATEWAY=fake; otherwise the real gateway needs its settings", () => {
    expect(() => gatewayFromEnv({ ROUTER_GATEWAY: "fake" })).not.toThrow();
    expect(() => gatewayFromEnv({})).toThrow(/ROUTER_URL/);
    expect(() =>
      gatewayFromEnv({ ROUTER_URL: "https://router.test", ROUTER_SERVICE_CREDENTIAL: "x" }),
    ).not.toThrow();
  });
});
