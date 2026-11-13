import type { Db } from "./db";

/** API 呼叫紀錄 data access. */

/** Student actions, named like the OpenAPI operationIds. */
export type StudentAction = "listSlots" | "listMyBookings" | "bookSlot" | "cancelBooking";

export type ApiCall = {
  /** ISO time */
  at: string;
  studentId: number;
  /** The student's latest 顯示名稱 */
  displayName: string;
  action: string;
  slotId: string | null;
  status: number;
  code: string | null;
};

export async function logApiCall(
  db: Db,
  call: {
    sessionId: string;
    at: Date;
    studentId: number;
    action: StudentAction;
    slotId: string | null;
    status: number;
    code: string | null;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO api_calls (session_id, at, student_id, action, slot_id, http_status, code)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [call.sessionId, call.at, call.studentId, call.action, call.slotId, call.status, call.code],
  );
}

/** A 堂課's API 呼叫紀錄, oldest first. */
export async function apiCallsOf(db: Db, sessionId: string): Promise<ApiCall[]> {
  const rows = await db.query<{
    at: Date | string;
    student_id: number;
    display_name: string;
    action: string;
    slot_id: string | null;
    http_status: number;
    code: string | null;
  }>(
    `SELECT c.at, c.student_id, s.display_name, c.action, c.slot_id, c.http_status, c.code
       FROM api_calls c JOIN students s ON s.student_id = c.student_id
      WHERE c.session_id = $1
      ORDER BY c.at, c.id`,
    [sessionId],
  );
  return rows.map((r) => ({
    at: new Date(r.at).toISOString(),
    studentId: r.student_id,
    displayName: r.display_name,
    action: r.action,
    slotId: r.slot_id,
    status: r.http_status,
    code: r.code,
  }));
}
