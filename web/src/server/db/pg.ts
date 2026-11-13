import { Pool, type PoolClient } from "pg";
import type { Db } from "./types";

function clientDb(client: PoolClient): Db {
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await client.query(sql, params);
      return result.rows as T[];
    },
    async exec(sql) {
      await client.query(sql);
    },
    async transaction() {
      throw new Error("Nested transactions are not supported.");
    },
    async close() {},
  };
}

/** Production driver: a `pg` pool on DATABASE_URL (Supabase pooler URL). */
export function pgDb(connectionString: string): Db {
  const pool = new Pool({ connectionString, max: 5 });
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await pool.query(sql, params);
      return result.rows as T[];
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const value = await fn(clientDb(client));
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}
