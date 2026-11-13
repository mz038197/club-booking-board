import type { Db } from "./db";
import type { Student } from "./router-gateway";

/** 學生 (router student id → latest 顯示名稱) and 堂課學生 (名冊) data access. */

export type RosterEntry = {
  studentId: number;
  displayName: string;
  /** ISO time of the student's first call in the 堂課 */
  firstCallAt: string;
  /** ISO time of the student's first successful 預約 in the 堂課, if any */
  firstBookedAt: string | null;
};

/** Records the 學生 and their latest 顯示名稱 (on every passing Key Check). */
export async function upsertStudent(db: Db, student: Student, now: Date): Promise<void> {
  await db.query(
    `INSERT INTO students (student_id, display_name, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (student_id) DO UPDATE
       SET display_name = EXCLUDED.display_name, updated_at = EXCLUDED.updated_at`,
    [student.studentId, student.displayName, now],
  );
}

/** Puts the student on the 堂課's 名冊 with this as their first call (if not already there). */
export async function recordFirstCall(
  db: Db,
  sessionId: string,
  studentId: number,
  now: Date,
): Promise<void> {
  await db.query(
    `INSERT INTO session_students (session_id, student_id, first_call_at) VALUES ($1, $2, $3)
     ON CONFLICT (session_id, student_id) DO NOTHING`,
    [sessionId, studentId, now],
  );
}

/** Marks the student's first successful 預約 in the 堂課 (kept if already set). */
export async function recordFirstBooking(
  db: Db,
  sessionId: string,
  studentId: number,
  now: Date,
): Promise<void> {
  await db.query(
    `INSERT INTO session_students (session_id, student_id, first_call_at, first_booked_at)
     VALUES ($1, $2, $3, $3)
     ON CONFLICT (session_id, student_id) DO UPDATE
       SET first_booked_at = COALESCE(session_students.first_booked_at, EXCLUDED.first_booked_at)`,
    [sessionId, studentId, now],
  );
}

/** 名冊: students who have called in the 堂課, ordered by first call. */
export async function rosterOf(db: Db, sessionId: string): Promise<RosterEntry[]> {
  const rows = await db.query<{
    student_id: number;
    display_name: string;
    first_call_at: Date | string;
    first_booked_at: Date | string | null;
  }>(
    `SELECT ss.student_id, s.display_name, ss.first_call_at, ss.first_booked_at
       FROM session_students ss JOIN students s ON s.student_id = ss.student_id
      WHERE ss.session_id = $1
      ORDER BY ss.first_call_at, ss.student_id`,
    [sessionId],
  );
  return rows.map((r) => ({
    studentId: r.student_id,
    displayName: r.display_name,
    firstCallAt: new Date(r.first_call_at).toISOString(),
    firstBookedAt: r.first_booked_at ? new Date(r.first_booked_at).toISOString() : null,
  }));
}
