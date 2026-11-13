import { describe, expect, it, vi } from "vitest";
import classroomAccepted from "../../../test/fixtures/router/key-check/classroom-accepted.json";
import personalAccepted from "../../../test/fixtures/router/key-check/personal-accepted.json";
import refused from "../../../test/fixtures/router/key-check/refused.json";
import badRequest from "../../../test/fixtures/router/key-check/bad-request.json";
import { createRouterGateway } from "./real";

const KEY = "vcr_sk_abcdefghijklmnopqrstuvwxyz0123456789";

type Call = { url: string; init: RequestInit };

function routerAnswering(answer: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return answer();
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeGateway(
  fetchFn: typeof fetch,
  opts: { now?: () => number; timeoutMs?: number } = {},
) {
  const logs: string[] = [];
  const gateway = createRouterGateway({
    routerUrl: "https://router.test/",
    serviceCredential: "svc-secret",
    fetch: fetchFn,
    now: opts.now,
    timeoutMs: opts.timeoutMs,
    log: (line) => logs.push(line),
  });
  return { gateway, logs };
}

describe("router gateway checkStudentKey", () => {
  it("asks Key Check with the Service Credential and returns the student", async () => {
    const router = routerAnswering(() => json(classroomAccepted));
    const { gateway } = makeGateway(router.fetchFn);

    const result = await gateway.checkStudentKey(KEY);

    expect(result).toEqual({
      ok: true,
      student: {
        studentId: 1234,
        classId: 56,
        classSessionId: 789,
        displayName: "07王小明",
      },
    });
    expect(router.calls).toHaveLength(1);
    expect(router.calls[0].url).toBe("https://router.test/internal/key-check");
    expect(router.calls[0].init.method).toBe("POST");
    expect(new Headers(router.calls[0].init.headers).get("authorization")).toBe(
      "Bearer svc-secret",
    );
    expect(JSON.parse(String(router.calls[0].init.body))).toEqual({ api_key: KEY });
  });

  it("names the student by id until the router sends display_name (router ADR 0095)", async () => {
    const withoutName: Record<string, unknown> = { ...classroomAccepted };
    delete withoutName.display_name;
    const router = routerAnswering(() => json(withoutName));
    const { gateway } = makeGateway(router.fetchFn);

    expect(await gateway.checkStudentKey(KEY)).toMatchObject({
      ok: true,
      student: { studentId: 1234, displayName: "學生 1234" },
    });
  });

  it("passes the router's refusal reason and message through", async () => {
    const router = routerAnswering(() =>
      json({ accepted: false, reason: "expired", message: "課堂已結束，金鑰已過期" }),
    );
    const { gateway } = makeGateway(router.fetchFn);

    expect(await gateway.checkStudentKey(KEY)).toEqual({
      ok: false,
      reason: "expired",
      message: "課堂已結束，金鑰已過期",
    });
  });

  it("refuses the contract's refused answer as invalid", async () => {
    const router = routerAnswering(() => json(refused));
    const { gateway } = makeGateway(router.fetchFn);

    expect(await gateway.checkStudentKey(KEY)).toEqual({
      ok: false,
      reason: "invalid",
      message: "無效的 API 金鑰",
    });
  });

  it("treats a Personal API Key answer as a refusal", async () => {
    const router = routerAnswering(() => json(personalAccepted));
    const { gateway } = makeGateway(router.fetchFn);

    const result = await gateway.checkStudentKey(KEY);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "not_a_student" });
  });

  it("refuses a missing or non-router key without asking the router", async () => {
    const router = routerAnswering(() => json(classroomAccepted));
    const { gateway } = makeGateway(router.fetchFn);

    expect(await gateway.checkStudentKey(null)).toMatchObject({ ok: false, reason: "invalid" });
    expect(await gateway.checkStudentKey("sk-not-ours")).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    expect(router.calls).toHaveLength(0);
  });

  it("caches an accepted key for 60 seconds", async () => {
    let now = 1_000_000;
    const router = routerAnswering(() => json(classroomAccepted));
    const { gateway } = makeGateway(router.fetchFn, { now: () => now });

    await gateway.checkStudentKey(KEY);
    now += 59_999;
    await gateway.checkStudentKey(KEY);
    expect(router.calls).toHaveLength(1);

    now += 1;
    await gateway.checkStudentKey(KEY);
    expect(router.calls).toHaveLength(2);
  });

  it("does not cache refusals", async () => {
    const router = routerAnswering(() => json(refused));
    const { gateway } = makeGateway(router.fetchFn);

    await gateway.checkStudentKey(KEY);
    await gateway.checkStudentKey(KEY);

    expect(router.calls).toHaveLength(2);
  });

  it("is unavailable when the router does not answer within the timeout", async () => {
    const router = routerAnswering(() => new Promise<Response>(() => {}));
    const { gateway } = makeGateway(router.fetchFn, { timeoutMs: 20 });

    expect(await gateway.checkStudentKey(KEY)).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
  });

  it("defaults to a 3 second timeout", async () => {
    vi.useFakeTimers();
    try {
      const router = routerAnswering(() => new Promise<Response>(() => {}));
      const { gateway } = makeGateway(router.fetchFn);
      let settled: unknown = "pending";
      void gateway.checkStudentKey(KEY).then((r) => (settled = r));

      await vi.advanceTimersByTimeAsync(2_999);
      expect(settled).toBe("pending");
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toMatchObject({ ok: false, reason: "unavailable" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("is unavailable on a non-200 answer", async () => {
    const router = routerAnswering(() => json(badRequest, 400));
    const { gateway } = makeGateway(router.fetchFn);

    expect(await gateway.checkStudentKey(KEY)).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
  });

  it("is unavailable when the answer is unreadable", async () => {
    for (const body of ["not json", JSON.stringify({ accepted: true, kind: "classroom" })]) {
      const router = routerAnswering(() => new Response(body, { status: 200 }));
      const { gateway } = makeGateway(router.fetchFn);
      expect(await gateway.checkStudentKey(KEY)).toMatchObject({
        ok: false,
        reason: "unavailable",
      });
    }
  });

  it("is unavailable when the network fails", async () => {
    const router = routerAnswering(() => {
      throw new TypeError("fetch failed");
    });
    const { gateway } = makeGateway(router.fetchFn);

    expect(await gateway.checkStudentKey(KEY)).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
  });

  it("logs only the key prefix, never the whole key", async () => {
    const router = routerAnswering(() => json(badRequest, 500));
    const { gateway, logs } = makeGateway(router.fetchFn);

    await gateway.checkStudentKey(KEY);

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.join("\n")).toContain(KEY.slice(0, 12));
    expect(logs.join("\n")).not.toContain(KEY);
    expect(logs.join("\n")).not.toContain(KEY.slice(0, 13));
  });
});
