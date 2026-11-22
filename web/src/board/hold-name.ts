/**
 * The 教師保留 name rule (ADR 0006), shared by the 日展開 dialog and the server: optional,
 * at most 20 字 (Unicode code points after trimming); blank is shown as 「保留」.
 */

/** What students see as the booker when the teacher gave no name. */
export const DEFAULT_HOLD_NAME = "保留";
export const MAX_HOLD_NAME_LENGTH = 20;

/** Why a 保留 name is refused, or null when it is fine (blank → shown as 「保留」). */
export function holdNameError(name: string): string | null {
  return [...name.trim()].length > MAX_HOLD_NAME_LENGTH ? `保留名字最多 ${MAX_HOLD_NAME_LENGTH} 字` : null;
}
