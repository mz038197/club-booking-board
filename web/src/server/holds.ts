import type { Db } from "./db";
import { ApiError } from "./http/errors";
import { MAX_HOLD_NAME_LENGTH } from "@/board/cell-dialog";

/**
 * 教師保留 (ADR 0006): a teacher's setting on a 可借格. Students and agents see the
 * 可借格 as 已借 with the 保留 name as the booker; it is not a 預約 (no 每人上限, no 海報).
 */

/** What students see as the booker when the teacher gave no name. */
export const DEFAULT_HOLD_NAME = "保留";

/** Validates the optional 保留 name; blank → null (shown as 「保留」). 400 INVALID_REQUEST otherwise. */
export function parseHoldName(body: Record<string, unknown>): string | null {
  const { name } = body;
  if (name === undefined || name === null) return null;
  if (typeof name !== "string") throw new ApiError(400, "INVALID_REQUEST", "保留名字必須是文字");
  const trimmed = name.trim();
  if ([...trimmed].length > MAX_HOLD_NAME_LENGTH) {
    throw new ApiError(400, "INVALID_REQUEST", `保留名字最多 ${MAX_HOLD_NAME_LENGTH} 字`);
  }
  return trimmed || null;
}

/**
 * Sets (or renames) the 教師保留 on a 可借格. Returns the name students see.
 * Throws 404 NOT_FOUND (no such 可借格) / 409 CONFLICT (已借 by a 預約).
 */
export async function setHold(
  db: Db,
  input: { sessionId: string; slotId: string; name: string | null; now: Date },
): Promise<string> {
  return db.transaction(async (tx) => {
    // FOR UPDATE: a concurrent 預約 (FOR KEY SHARE on the 可借格) either lands first and
    // we see it 已借, or waits and then sees the 保留.
    const [slot] = await tx.query<{ booked: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = s.session_id AND b.slot_id = s.slot_id) AS booked
         FROM slots s WHERE s.session_id = $1 AND s.slot_id = $2 FOR UPDATE`,
      [input.sessionId, input.slotId],
    );
    if (!slot) throw new ApiError(404, "NOT_FOUND", "這堂課沒有這個可借格");
    if (slot.booked) throw new ApiError(409, "CONFLICT", "這個可借格已經有人預約，不能設保留");
    await tx.query(
      `INSERT INTO slot_holds (session_id, slot_id, name, created_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, slot_id) DO UPDATE SET name = EXCLUDED.name`,
      [input.sessionId, input.slotId, input.name, input.now],
    );
    return input.name ?? DEFAULT_HOLD_NAME;
  });
}

/** 解除保留. Throws 404 NOT_FOUND when the 可借格 has no 保留. */
export async function releaseHold(db: Db, input: { sessionId: string; slotId: string }): Promise<void> {
  const rows = await db.query(
    `DELETE FROM slot_holds WHERE session_id = $1 AND slot_id = $2 RETURNING slot_id`,
    [input.sessionId, input.slotId],
  );
  if (rows.length === 0) throw new ApiError(404, "NOT_FOUND", "這個可借格沒有保留");
}
