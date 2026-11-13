import { dbFromEnv, type Db } from "./db";
import { gatewayFromEnv, type RouterGateway } from "./router-gateway";

/**
 * What route handlers depend on. Built once from env in the app;
 * tests replace it with `setDepsForTests` (see test/helpers/app.ts).
 */
export type Deps = {
  db: Db;
  gateway: RouterGateway;
  now: () => Date;
};

const holder = globalThis as unknown as { __deps?: Promise<Deps>; __testDeps?: Deps | null };

export async function getDeps(): Promise<Deps> {
  if (holder.__testDeps) return holder.__testDeps;
  holder.__deps ??= (async () => ({
    db: await dbFromEnv(process.env),
    gateway: gatewayFromEnv(process.env),
    now: () => new Date(),
  }))();
  return holder.__deps;
}

export function setDepsForTests(deps: Deps | null): void {
  holder.__testDeps = deps;
}
