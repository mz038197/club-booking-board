import { PGlite } from "@electric-sql/pglite";
import type { Db } from "@/server/db";
import { migrate } from "@/server/db/migrate";
import { pgliteDb } from "@/server/db/pglite";

// One migrated in-memory Postgres per test worker; every test gets a clone.
let template: Promise<PGlite> | null = null;

/** A fresh, fully migrated, empty database. Close it when the test ends. */
export async function createTestDb(): Promise<Db> {
  template ??= (async () => {
    const pg = new PGlite();
    await migrate(pgliteDb(pg));
    return pg;
  })();
  return pgliteDb(await (await template).clone());
}
