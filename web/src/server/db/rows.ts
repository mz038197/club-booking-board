/**
 * A `timestamptz` column as it comes back from either driver (pg gives a Date,
 * PGlite may give a Date or a string) → ISO 8601 string, as the API sends it.
 */
export function isoOf(value: Date | string): string;
export function isoOf(value: Date | string | null): string | null;
export function isoOf(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

/** Row type of a `timestamptz` column. */
export type RowTime = Date | string;
