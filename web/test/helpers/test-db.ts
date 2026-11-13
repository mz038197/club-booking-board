import { PGlite } from "@electric-sql/pglite";
import type { Db } from "@/server/db";
import { migrate } from "@/server/db/migrate";
import { pgliteDb } from "@/server/db/pglite";
import { createPostgresTestDb, postgresTestUrl } from "./postgres-test-db";

// One migrated in-memory Postgres per test worker; every test gets a clone.
let template: Promise<PGlite> | null = null;

function migratedTemplate(): Promise<PGlite> {
  template ??= (async () => {
    const pg = new PGlite();
    await migrate(pgliteDb(pg));
    return pg;
  })().catch((error: unknown) => {
    // Don't cache a failed boot (e.g. a slow worker hitting the hook timeout): the next test retries.
    template = null;
    throw error;
  });
  return template;
}

/**
 * A fresh, fully migrated, empty database. Close it when the test ends.
 * PGlite by default; real Postgres (a fresh database per call) when `realPostgres`
 * is set and TEST_DATABASE_URL is configured.
 */
export async function createTestDb(options: { realPostgres?: boolean } = {}): Promise<Db> {
  if (options.realPostgres) {
    const url = postgresTestUrl();
    if (!url) throw new Error("TEST_DATABASE_URL is not set");
    return createPostgresTestDb(url);
  }
  return pgliteDb(await (await migratedTemplate()).clone());
}
