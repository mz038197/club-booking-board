import { describe, expect, it } from "vitest";
import accepted from "../../../test/fixtures/router/teacher-classes/accepted.json";
import refused from "../../../test/fixtures/router/teacher-classes/refused.json";
import { createRouterGateway } from "./real";

type Call = { url: string; init: RequestInit };

function routerAnswering(answer: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return answer();
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function makeGateway(fetchFn: typeof fetch, opts: { now?: () => number; timeoutMs?: number } = {}) {
  return createRouterGateway({
    routerUrl: "https://router.test",
    serviceCredential: "svc-secret",
    fetch: fetchFn,
    now: opts.now,
    timeoutMs: opts.timeoutMs,
    log: () => {},
  });
}

describe("router gateway teacherClasses", () => {
  it("asks the router's class lookup with the Service Credential", async () => {
    const router = routerAnswering(() => json(accepted));
    const gateway = makeGateway(router.fetchFn);

    const result = await gateway.teacherClasses(42);

    expect(result).toEqual({
      ok: true,
      isAdmin: false,
      classes: [
        { id: 56, name: "週一 程式設計" },
        { id: 57, name: "週三 進階班" },
      ],
    });
    expect(router.calls[0].url).toBe("https://router.test/internal/teacher-classes");
    expect(router.calls[0].init.method).toBe("POST");
    expect(new Headers(router.calls[0].init.headers).get("authorization")).toBe("Bearer svc-secret");
    expect(JSON.parse(String(router.calls[0].init.body))).toEqual({ user_id: 42 });
  });

  it("passes the admin standing through", async () => {
    const router = routerAnswering(() => json({ ...accepted, is_admin: true }));
    expect(await makeGateway(router.fetchFn).teacherClasses(42)).toMatchObject({
      ok: true,
      isAdmin: true,
    });
  });

  it("treats a refusal (no longer a teacher) as no 班級", async () => {
    const router = routerAnswering(() => json(refused));
    expect(await makeGateway(router.fetchFn).teacherClasses(42)).toEqual({
      ok: true,
      isAdmin: false,
      classes: [],
    });
  });

  it("caches the answer for 60 seconds per user", async () => {
    let now = 5_000_000;
    const router = routerAnswering(() => json(accepted));
    const gateway = makeGateway(router.fetchFn, { now: () => now });

    await gateway.teacherClasses(42);
    now += 59_999;
    await gateway.teacherClasses(42);
    expect(router.calls).toHaveLength(1);

    await gateway.teacherClasses(43);
    expect(router.calls).toHaveLength(2);

    now += 1;
    await gateway.teacherClasses(42);
    expect(router.calls).toHaveLength(3);
  });

  it("is unavailable (and not cached) on a non-200, unreadable answer, or timeout", async () => {
    const answers = [
      () => json({ detail: "boom" }, 500),
      () => new Response("not json"),
      () => json({ accepted: true, classes: "nope" }),
      () => new Promise<Response>(() => {}),
    ];
    for (const answer of answers) {
      const router = routerAnswering(answer);
      const gateway = makeGateway(router.fetchFn, { timeoutMs: 20 });
      expect(await gateway.teacherClasses(42)).toEqual({ ok: false, reason: "unavailable" });
    }
  });
});
