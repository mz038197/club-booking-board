import { PGlite, type PGliteInterface, type Transaction } from "@electric-sql/pglite";
import type { Db } from "./types";

type Queryable = Pick<PGliteInterface, "query" | "exec"> | Transaction;

function wrap(target: Queryable, owner: PGliteInterface | null): Db {
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await target.query<T>(sql, params);
      return result.rows;
    },
    async exec(sql) {
      await target.exec(sql);
    },
    async transaction(fn) {
      if (!owner) throw new Error("Nested transactions are not supported.");
      return owner.transaction((tx) => fn(wrap(tx, null)));
    },
    async close() {
      if (owner && !owner.closed) await owner.close();
    },
  };
}

/** Wraps an open PGlite instance (in-memory for tests, a directory for local dev). */
export function pgliteDb(pglite: PGliteInterface): Db {
  return wrap(pglite, pglite);
}

export function openPglite(dataDir?: string): Db {
  return pgliteDb(new PGlite(dataDir));
}
