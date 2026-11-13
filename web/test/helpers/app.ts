import type { Db } from "@/server/db";
import { setDepsForTests, type Deps } from "@/server/deps";
import { createFakeGateway } from "@/server/router-gateway/fake";
import type { RouterGateway } from "@/server/router-gateway";
import { resolveRoute } from "./routes";
import { createTestDb } from "./test-db";

export type RequestOptions = {
  /** Sent as `Authorization: Bearer <key>` (see FAKE_KEYS). */
  key?: string;
  /** JSON body. */
  body?: unknown;
  headers?: Record<string, string>;
};

export type TestApp = {
  db: Db;
  deps: Deps;
  /** Calls the Next.js route handler in-process, like an HTTP request. */
  request(method: string, path: string, options?: RequestOptions): Promise<Response>;
  close(): Promise<void>;
};

/**
 * Fresh test DB + fake router gateway, installed as the app's deps.
 * Override `gateway` or `now` to change them for one test.
 */
export async function setupTestApp(
  overrides: { gateway?: RouterGateway; now?: () => Date } = {},
): Promise<TestApp> {
  const db = await createTestDb();
  const deps: Deps = {
    db,
    gateway: overrides.gateway ?? createFakeGateway({}),
    now: overrides.now ?? (() => new Date()),
  };
  setDepsForTests(deps);

  return {
    db,
    deps,
    async request(method, path, options = {}) {
      const url = new URL(path, "http://localhost");
      const route = await resolveRoute(method, url.pathname);
      if (!route) throw new Error(`No route for ${method} ${url.pathname} in test/helpers/routes.ts`);
      const headers = new Headers(options.headers);
      if (options.key) headers.set("authorization", `Bearer ${options.key}`);
      let body: string | undefined;
      if (options.body !== undefined) {
        headers.set("content-type", "application/json");
        body = JSON.stringify(options.body);
      }
      const req = new Request(url, { method, headers, body });
      return route.handler(req, { params: Promise.resolve(route.params) });
    },
    async close() {
      setDepsForTests(null);
      await db.close();
    },
  };
}
