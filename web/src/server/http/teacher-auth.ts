import { createHmac, timingSafeEqual } from "node:crypto";
import type { Deps } from "../deps";
import type { ClassRef, Teacher } from "../router-gateway";
import { ApiError } from "./errors";
import { ROUTER_UNAVAILABLE_NOTICE } from "./student-auth";

/** Signed teacher session: `<base64url JSON {uid,name,exp}>.<base64url HMAC-SHA256>`. */
export const TEACHER_COOKIE = "cbb_teacher";
export const TEACHER_SESSION_SECONDS = 12 * 60 * 60;

export const LOGIN_REQUIRED_NOTICE = "請先登入教師後台";
export const NOT_YOUR_CLASS_NOTICE = "你沒有管理這個班級的權限";

/** What a teacher request may touch, decided per request by the router (cached 60 s). */
export type TeacherAccess = {
  teacher: Teacher;
  isAdmin: boolean;
  classes: ClassRef[];
};

const MIN_SECRET_LENGTH = 32;

function hmac(data: string, secret: string): Buffer {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`TEACHER_SESSION_SECRET must be set (at least ${MIN_SECRET_LENGTH} characters).`);
  }
  return createHmac("sha256", secret).update(data).digest();
}

/** `payload.signature`, both base64url. Used for the session and the login cookie. */
export function seal(payload: Record<string, unknown>, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret).toString("base64url")}`;
}

/** The payload of a value made by `seal` with the same secret, or `null`. */
export function unseal(value: string | undefined, secret: string): Record<string, unknown> | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1), "base64url");
  const expected = hmac(body, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The session cookie value for a teacher who just signed in at `issuedAt` (valid 12 hours). */
export function signTeacherSession(teacher: Teacher, secret: string, issuedAt: Date): string {
  const exp = Math.floor(issuedAt.getTime() / 1000) + TEACHER_SESSION_SECONDS;
  return seal({ uid: teacher.userId, name: teacher.displayName, exp }, secret);
}

/** The signed-in teacher, or `null` when the cookie is missing, forged or expired. */
export function readTeacherSession(value: string | undefined, secret: string, now: Date): Teacher | null {
  const claims = unseal(value, secret);
  if (!claims) return null;
  const { uid, name, exp } = claims;
  if (typeof uid !== "number" || !Number.isInteger(uid) || typeof name !== "string") return null;
  if (typeof exp !== "number" || now.getTime() / 1000 >= exp) return null;
  return { userId: uid, displayName: name };
}

export type CookieOptions = { maxAge: number; path?: string };

/** A Set-Cookie line: always HttpOnly, Secure, SameSite=Lax. */
export function cookieLine(name: string, value: string, { maxAge, path = "/" }: CookieOptions): string {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function teacherSessionCookie(teacher: Teacher, deps: Deps): string {
  return cookieLine(TEACHER_COOKIE, signTeacherSession(teacher, deps.sessionSecret, deps.now()), {
    maxAge: TEACHER_SESSION_SECONDS,
  });
}

export function clearedTeacherSessionCookie(): string {
  return cookieLine(TEACHER_COOKIE, "", { maxAge: 0 });
}

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/**
 * Who is signed in and which 班級 they may manage, from the session cookie value.
 * `null` when not signed in; throws 503 ROUTER_UNAVAILABLE when the router cannot answer.
 * Pages use this with `cookies()`; route handlers use `requireTeacher`.
 */
export async function teacherAccess(cookieValue: string | undefined, deps: Deps): Promise<TeacherAccess | null> {
  const teacher = readTeacherSession(cookieValue, deps.sessionSecret, deps.now());
  if (!teacher) return null;
  const lookup = await deps.gateway.teacherClasses(teacher.userId);
  if (!lookup.ok) throw new ApiError(503, "ROUTER_UNAVAILABLE", ROUTER_UNAVAILABLE_NOTICE);
  return { teacher, isAdmin: lookup.isAdmin, classes: lookup.classes };
}

/** The signed-in teacher's access; 401 UNAUTHORIZED without a valid cookie. */
export async function requireTeacher(req: Request, deps: Deps): Promise<TeacherAccess> {
  const access = await teacherAccess(readCookie(req, TEACHER_COOKIE), deps);
  if (!access) throw new ApiError(401, "UNAUTHORIZED", LOGIN_REQUIRED_NOTICE);
  return access;
}

/** Parses a `班級` id path param; 400 INVALID_REQUEST when it is not a positive integer. */
export function parseClassId(raw: string): number {
  if (!/^\d{1,9}$/.test(raw)) throw new ApiError(400, "INVALID_REQUEST", "班級 id 必須是正整數");
  return Number(raw);
}

/** The 班級 when this teacher may manage it (an admin may manage any); else `null`. */
export function managedClass(access: TeacherAccess, classId: number): ClassRef | null {
  const owned = access.classes.find((c) => c.id === classId);
  if (owned) return owned;
  return access.isAdmin ? { id: classId, name: `班級 ${classId}` } : null;
}

/** Like `managedClass`, but throws 403 FORBIDDEN when the teacher may not manage it. */
export function requireClassAccess(access: TeacherAccess, classId: number): ClassRef {
  const found = managedClass(access, classId);
  if (!found) throw new ApiError(403, "FORBIDDEN", NOT_YOUR_CLASS_NOTICE);
  return found;
}
