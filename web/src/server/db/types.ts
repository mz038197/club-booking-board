/**
 * The one database interface the app uses. Production backs it with `pg`
 * (Supabase Postgres); tests and local dev back it with PGlite.
 * SQL uses Postgres `$1, $2` placeholders.
 */
export interface Db {
  /** One parameterised statement; returns the rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Several statements, no parameters (migrations). */
  exec(sql: string): Promise<void>;
  /** Runs `fn` in a transaction; commits if it resolves, rolls back if it throws. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
