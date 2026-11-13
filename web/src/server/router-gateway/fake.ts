import { createHash } from "node:crypto";
import {
  INVALID_NOTICE,
  NOT_A_STUDENT_NOTICE,
  UNAVAILABLE_NOTICE,
  type ClassRef,
  type RouterGateway,
  type StudentKeyCheck,
  type Teacher,
} from "./types";

type Env = Record<string, string | undefined>;

/**
 * Fixed keys the fake gateway knows. Use them in tests, local dev and
 * Agent Builder trials before the router's OAuth exists.
 */
export const FAKE_KEYS = {
  /** 班級 56, student 1234 「07王小明」 */
  studentA: "vcr_sk_fake_student_56a",
  /** 班級 56, student 1235 「08李小華」 */
  studentB: "vcr_sk_fake_student_56b",
  /** 班級 57, student 2001 「01陳大文」 */
  otherClass: "vcr_sk_fake_student_57",
  /** A teacher's Personal API Key → refused as not_a_student */
  personal: "vcr_sk_fake_personal",
  disabled: "vcr_sk_fake_disabled",
  notStarted: "vcr_sk_fake_not_started",
  expired: "vcr_sk_fake_expired",
  /** Simulates the router not answering → unavailable */
  unavailable: "vcr_sk_fake_unavailable",
} as const;

export const FAKE_CLASS_ID = 56;
export const FAKE_OTHER_CLASS_ID = 57;

export const FAKE_NOTICES = {
  disabled: "此課堂金鑰已停用",
  notStarted: "課堂尚未開始，請在上課時間使用",
  expired: "課堂已結束，金鑰已過期",
} as const;

const ANSWERS: Record<string, StudentKeyCheck> = {
  [FAKE_KEYS.studentA]: {
    ok: true,
    student: { studentId: 1234, classId: 56, classSessionId: 789, displayName: "07王小明" },
  },
  [FAKE_KEYS.studentB]: {
    ok: true,
    student: { studentId: 1235, classId: 56, classSessionId: 789, displayName: "08李小華" },
  },
  [FAKE_KEYS.otherClass]: {
    ok: true,
    student: { studentId: 2001, classId: 57, classSessionId: 790, displayName: "01陳大文" },
  },
  [FAKE_KEYS.personal]: { ok: false, reason: "not_a_student", message: NOT_A_STUDENT_NOTICE },
  [FAKE_KEYS.disabled]: { ok: false, reason: "disabled", message: FAKE_NOTICES.disabled },
  [FAKE_KEYS.notStarted]: { ok: false, reason: "not_started", message: FAKE_NOTICES.notStarted },
  [FAKE_KEYS.expired]: { ok: false, reason: "expired", message: FAKE_NOTICES.expired },
  [FAKE_KEYS.unavailable]: { ok: false, reason: "unavailable", message: UNAVAILABLE_NOTICE },
};

export const FAKE_CLASSES: Record<"monday" | "wednesday", ClassRef> = {
  monday: { id: FAKE_CLASS_ID, name: "週一 程式設計" },
  wednesday: { id: FAKE_OTHER_CLASS_ID, name: "週三 進階班" },
};

type FakeTeacher = Teacher & { isAdmin: boolean; classes: ClassRef[] };

/** Fixed teachers the fake login page offers (instead of the router's Google sign-in). */
export const FAKE_TEACHERS = {
  /** Owns 班級 56 */
  teacher: { userId: 42, displayName: "林老師", isAdmin: false, classes: [FAKE_CLASSES.monday] },
  /** Owns 班級 57 */
  otherTeacher: { userId: 43, displayName: "陳老師", isAdmin: false, classes: [FAKE_CLASSES.wednesday] },
  /** A teacher with no 班級 */
  noClasses: { userId: 44, displayName: "張老師", isAdmin: false, classes: [] },
  /** Admin: manages every 班級 */
  admin: { userId: 1, displayName: "系統管理員", isAdmin: true, classes: [FAKE_CLASSES.monday, FAKE_CLASSES.wednesday] },
} as const satisfies Record<string, FakeTeacher>;

/** The fake router's authorize page, served by this app only with the fake gateway. */
export const FAKE_AUTHORIZE_PATH = "/dev/fake-router/authorize";

const s256 = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

/**
 * What the fake authorize page does when a fake teacher is picked: the callback
 * URL (redirect_uri + code + state). The code binds the teacher to the PKCE challenge.
 */
export function fakeApproveLogin(authorizeUrl: string, userId: number): string {
  const params = new URL(authorizeUrl, "http://localhost").searchParams;
  const callback = new URL(params.get("redirect_uri") ?? "");
  callback.searchParams.set("code", `fake.${userId}.${params.get("code_challenge") ?? ""}`);
  callback.searchParams.set("state", params.get("state") ?? "");
  return callback.toString();
}

function findFakeTeacher(userId: number): FakeTeacher | undefined {
  return Object.values(FAKE_TEACHERS).find((t) => t.userId === userId);
}

/**
 * Production = Vercel production, or NODE_ENV=production outside Vercel.
 * Vercel preview deployments (VERCEL_ENV=preview) are not production.
 */
export function isProduction(env: Env): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return env.NODE_ENV === "production";
}

/** Development gateway answering from FAKE_KEYS. Throws in production. */
export function createFakeGateway(env: Env): RouterGateway {
  if (isProduction(env)) {
    throw new Error("The fake router gateway must not run in production.");
  }
  return {
    async checkStudentKey(key) {
      return (
        ANSWERS[(key ?? "").trim()] ?? { ok: false, reason: "invalid", message: INVALID_NOTICE }
      );
    },

    teacherLoginUrl({ redirectUri, state, codeChallenge }) {
      const url = new URL(FAKE_AUTHORIZE_PATH, redirectUri);
      url.search = new URLSearchParams({
        redirect_uri: redirectUri,
        state,
        code_challenge: codeChallenge,
      }).toString();
      return url.toString();
    },

    async completeTeacherLogin({ code, codeVerifier }) {
      const match = /^fake\.(\d+)\.(.+)$/.exec(code);
      const teacher = match ? findFakeTeacher(Number(match[1])) : undefined;
      if (!match || !teacher || match[2] !== s256(codeVerifier)) return { ok: false, reason: "invalid" };
      return { ok: true, teacher: { userId: teacher.userId, displayName: teacher.displayName } };
    },

    async teacherClasses(userId) {
      const teacher = findFakeTeacher(userId);
      return {
        ok: true,
        isAdmin: teacher?.isAdmin ?? false,
        classes: teacher ? [...teacher.classes] : [],
      };
    },
  };
}
