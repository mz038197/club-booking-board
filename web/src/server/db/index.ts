import { pgDb } from "./pg";
import { openPglite } from "./pglite";
import type { Db } from "./types";

export type { Db } from "./types";

type Env = Record<string, string | undefined>;

/**
 * DATABASE_URL=postgres://… → pg (production, Supabase).
 * DATABASE_URL=pglite:<dir>  → PGlite on disk (local dev without Postgres).
 * The app never migrates; run `npm run db:migrate` (or `db:seed`) first.
 */
export async function dbFromEnv(env: Env): Promise<Db> {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set (see web/.env.example).");
  if (url.startsWith("pglite:")) return openPglite(url.slice("pglite:".length) || undefined);
  return pgDb(url);
}
