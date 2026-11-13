import { randomBytes } from "node:crypto";
import { Client } from "pg";
import type { Db } from "@/server/db";
import { migrate } from "@/server/db/migrate";
import { pgDb } from "@/server/db/pg";

/**
 * Opt-in real Postgres for tests (PGlite is single-connection, so it cannot show
 * real concurrency). Set TEST_DATABASE_URL to a server you may create databases on,
 * e.g. postgres://postgres:pw@localhost:55432/postgres — see notes in conventions.
 */
export function postgresTestUrl(): string | undefined {
  const url = process.env.TEST_DATABASE_URL?.trim();
  return url ? url : undefined;
}

async function admin<T>(url: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** A freshly created, migrated database on the TEST_DATABASE_URL server; dropped on close. */
export async function createPostgresTestDb(url: string): Promise<Db> {
  const name = `cbb_test_${randomBytes(6).toString("hex")}`;
  await admin(url, (c) => c.query(`CREATE DATABASE ${name}`));
  const dbUrl = new URL(url);
  dbUrl.pathname = `/${name}`;
  const db = pgDb(dbUrl.toString());
  try {
    await migrate(db);
  } catch (error) {
    await db.close();
    await admin(url, (c) => c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
    throw error;
  }
  return {
    ...db,
    async close() {
      await db.close();
      await admin(url, (c) => c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
    },
  };
}
