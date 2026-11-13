/**
 * The router gateway is the only module that talks to the router
 * (ai.vanscoding.com). Everything else depends on this interface.
 * Later tickets add `teacherClasses` and `completeTeacherLogin` here.
 */

export type Student = {
  studentId: number;
  classId: number;
  classSessionId: number;
  displayName: string;
};

/**
 * `invalid` / `disabled` / `not_started` / `expired` come from the router;
 * `not_a_student` means the key is a Personal API Key (a teacher's);
 * `unavailable` means the router could not answer.
 */
export type RefusalReason =
  | "invalid"
  | "disabled"
  | "not_started"
  | "expired"
  | "not_a_student"
  | "unavailable";

export type StudentKeyCheck =
  | { ok: true; student: Student }
  | { ok: false; reason: RefusalReason; message: string };

export interface RouterGateway {
  checkStudentKey(key: string | null): Promise<StudentKeyCheck>;
}

export const KEY_PREFIX = "vcr_sk_";
export const INVALID_NOTICE = "無效的 API 金鑰";
export const UNAVAILABLE_NOTICE = "驗證服務暫時無法使用，請稍後再試";
export const NOT_A_STUDENT_NOTICE = "這是教師的個人金鑰，不能代表學生；請改用課堂金鑰";

const LOGGED_KEY_CHARS = 12;

/** The only part of a key that may reach a log. */
export function keyPrefix(key: string): string {
  return key.slice(0, LOGGED_KEY_CHARS);
}
