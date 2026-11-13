import type { Db } from "./db";
import { isoOf, type RowTime } from "./db/rows";
import type { Teacher } from "./router-gateway";

/** 教師操作紀錄: the admin actions taken on a 堂課 (per 堂課, newest first). */

/** Admin action names (stable codes; the UI shows `message`). */
export type AdminAction =
  | "createSession"
  | "makeCurrent"
  | "generateSlots"
  | "removeSlot"
  | "replaceSlots"
  | "forceCancel"
  | "resetSession"
  | "displaySettings"
  | "setRules"
  | "setPaused"
  | "shareLink";

export type AdminLogEntry = {
  /** ISO time */
  at: string;
  teacher: { userId: number; displayName: string };
  action: string;
  /** What happened, in Traditional Chinese, for the 操作紀錄 list */
  message: string;
};

export async function logAdminAction(
  db: Db,
  entry: { sessionId: string; at: Date; teacher: Teacher; action: AdminAction; message: string },
): Promise<void> {
  await db.query(
    `INSERT INTO admin_actions (session_id, at, teacher_id, teacher_name, action, message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entry.sessionId, entry.at, entry.teacher.userId, entry.teacher.displayName, entry.action, entry.message],
  );
}

/** A 堂課's 教師操作紀錄, newest first (at most `limit`). */
export async function adminLogOf(db: Db, sessionId: string, limit = 200): Promise<AdminLogEntry[]> {
  const rows = await db.query<{
    at: RowTime;
    teacher_id: number;
    teacher_name: string;
    action: string;
    message: string;
  }>(
    `SELECT at, teacher_id, teacher_name, action, message
       FROM admin_actions WHERE session_id = $1
      ORDER BY at DESC, id DESC
      LIMIT $2`,
    [sessionId, limit],
  );
  return rows.map((r) => ({
    at: isoOf(r.at),
    teacher: { userId: r.teacher_id, displayName: r.teacher_name },
    action: r.action,
    message: r.message,
  }));
}
