/**
 * The router gateway is the only module that talks to the router
 * (ai.vanscoding.com). Everything else depends on this interface.
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

/** A teacher (or admin) signed in through the router's `openid teacher` scope. */
export type Teacher = {
  userId: number;
  displayName: string;
};

export type ClassRef = { id: number; name: string };

/** Which 班級 a user may manage. An admin may manage every 班級. */
export type TeacherClasses =
  | { ok: true; isAdmin: boolean; classes: ClassRef[] }
  | { ok: false; reason: "unavailable" };

/** `invalid`: the code, PKCE verifier or ID token was not accepted. */
export type TeacherLogin =
  | { ok: true; teacher: Teacher }
  | { ok: false; reason: "invalid" | "unavailable" };

export type TeacherLoginStart = {
  /** Our callback URL, registered with the router for the OAuth Client. */
  redirectUri: string;
  state: string;
  /** PKCE S256 challenge of the verifier kept in the login cookie. */
  codeChallenge: string;
};

export type TeacherLoginFinish = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
};

export interface RouterGateway {
  checkStudentKey(key: string | null): Promise<StudentKeyCheck>;
  /** Where to send the browser for 「用 Google 登入」 (router `/oauth/authorize`). */
  teacherLoginUrl(start: TeacherLoginStart): string;
  /** Exchanges the authorization code for an ID token and verifies its signature and audience. */
  completeTeacherLogin(finish: TeacherLoginFinish): Promise<TeacherLogin>;
  /** The 班級 a user may manage, asked with our Service Credential; cached 60 s. */
  teacherClasses(userId: number): Promise<TeacherClasses>;
}

/** OAuth Client id of the teacher admin, registered in the router (router ADR 0094). */
export const TEACHER_OAUTH_CLIENT_ID = "club-booking-admin";
export const TEACHER_OAUTH_SCOPE = "openid teacher";

export const KEY_PREFIX = "vcr_sk_";
export const INVALID_NOTICE = "無效的 API 金鑰";
export const UNAVAILABLE_NOTICE = "驗證服務暫時無法使用，請稍後再試";
export const NOT_A_STUDENT_NOTICE = "這是教師的個人金鑰，不能代表學生；請改用課堂金鑰";

const LOGGED_KEY_CHARS = 12;

/** The only part of a key that may reach a log. */
export function keyPrefix(key: string): string {
  return key.slice(0, LOGGED_KEY_CHARS);
}
