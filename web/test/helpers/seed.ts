import type { Db } from "@/server/db";

/**
 * Test-only setup for state no endpoint creates yet. Replace a helper here
 * with the real endpoint or data function once a ticket adds one.
 */
export async function seedBooking(
  db: Db,
  input: { sessionId: string; slotId: string; studentId: number; displayName: string },
): Promise<void> {
  await db.query(
    `INSERT INTO students (student_id, display_name) VALUES ($1, $2)
     ON CONFLICT (student_id) DO UPDATE SET display_name = EXCLUDED.display_name`,
    [input.studentId, input.displayName],
  );
  await db.query(`INSERT INTO bookings (session_id, slot_id, student_id) VALUES ($1, $2, $3)`, [
    input.sessionId,
    input.slotId,
    input.studentId,
  ]);
}
