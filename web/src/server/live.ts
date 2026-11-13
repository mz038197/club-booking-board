import type { Db } from "./db";

/** 上課中 reads and actions on a whole 堂課 (統計, 重置堂課). */

export type SessionStats = {
  /** 可借格 in the 可借清單 */
  slotCount: number;
  /** 已借 可借格 */
  bookedCount: number;
  /** Students on the 名冊 (called at least once) */
  calledStudents: number;
  /** Students holding at least one 預約 now */
  bookedStudents: number;
};

/**
 * 重置堂課 (e.g. after a rehearsal): deletes the 堂課's 預約 and API 呼叫紀錄.
 * Keeps the 可借清單, 預約規則 and the 名冊 (who called, in which order); each
 * student's first-booking time is cleared with the 預約. The 教師操作紀錄 is kept.
 */
export async function resetSession(db: Db, sessionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(`DELETE FROM bookings WHERE session_id = $1`, [sessionId]);
    await tx.query(`DELETE FROM api_calls WHERE session_id = $1`, [sessionId]);
    await tx.query(`UPDATE session_students SET first_booked_at = NULL WHERE session_id = $1`, [sessionId]);
  });
}

export async function statsOf(db: Db, sessionId: string): Promise<SessionStats> {
  const [row] = await db.query<{
    slot_count: number | string;
    booked_count: number | string;
    called_students: number | string;
    booked_students: number | string;
  }>(
    `SELECT (SELECT count(*) FROM slots WHERE session_id = $1) AS slot_count,
            (SELECT count(*) FROM bookings WHERE session_id = $1) AS booked_count,
            (SELECT count(*) FROM session_students WHERE session_id = $1) AS called_students,
            (SELECT count(DISTINCT student_id) FROM bookings WHERE session_id = $1) AS booked_students`,
    [sessionId],
  );
  return {
    slotCount: Number(row.slot_count),
    bookedCount: Number(row.booked_count),
    calledStudents: Number(row.called_students),
    bookedStudents: Number(row.booked_students),
  };
}
