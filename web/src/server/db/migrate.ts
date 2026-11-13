import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Db } from "./types";

/** `web/db/migrations`, resolved from the web/ working directory. */
export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

/**
 * Applies every `NNNN_name.sql` in order that is not yet recorded in
 * `schema_migrations`. Each file runs in its own transaction.
 */
export async function migrate(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
  const applied = new Set(
    (await db.query<{ name: string }>("SELECT name FROM schema_migrations")).map((r) => r.name),
  );
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(dir, file), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    ran.push(file);
  }
  return ran;
}
