import { createHash, type JsonWebKey } from "node:crypto";
import { verifyIdToken } from "./id-token";
import {
  INVALID_NOTICE,
  KEY_PREFIX,
  NOT_A_STUDENT_NOTICE,
  TEACHER_OAUTH_CLIENT_ID,
  TEACHER_OAUTH_SCOPE,
  UNAVAILABLE_NOTICE,
  keyPrefix,
  type ClassRef,
  type RefusalReason,
  type RouterGateway,
  type Student,
  type StudentKeyCheck,
  type TeacherClasses,
  type TeacherLogin,
} from "./types";

const KEY_CHECK_PATH = "/internal/key-check";
/** Proposed path; see test/fixtures/router/teacher-classes/README.md. */
const TEACHER_CLASSES_PATH = "/internal/teacher-classes";
const AUTHORIZE_PATH = "/oauth/authorize";
const DISCOVERY_PATH = "/.well-known/openid-configuration";
const PASS_CACHE_MS = 60_000;
const CLASSES_CACHE_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 3_000;
const ROUTER_REASONS: readonly RefusalReason[] = ["invalid", "disabled", "not_started", "expired"];

export type RouterGatewayOptions = {
  routerUrl: string;
  serviceCredential: string;
  /** OAuth Client id of the teacher admin; defaults to `club-booking-admin`. */
  oauthClientId?: string;
  fetch?: typeof fetch;
  /** Milliseconds; injectable so cache expiry can be tested. */
  now?: () => number;
  timeoutMs?: number;
  log?: (line: string) => void;
};

type Exchange = { status: number; text: string } | { failure: string };

/**
 * Real gateway: the router's Key Check (router ADR 0079/0082/0095), its
 * class lookup and its OpenID Connect `openid teacher` login (router ADR 0094).
 */
export function createRouterGateway(options: RouterGatewayOptions): RouterGateway {
  const baseUrl = options.routerUrl.replace(/\/+$/, "");
  const clientId = options.oauthClientId ?? TEACHER_OAUTH_CLIENT_ID;
  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = options.log ?? ((line: string) => console.error(line));
  // SHA-256 of the key -> accepted student and expiry. Never the key itself.
  const passes = new Map<string, { student: Student; until: number }>();
  // user id -> answered class lookup and expiry.
  const classLookups = new Map<number, { answer: TeacherClasses; until: number }>();

  /** One router request; the whole exchange (headers and body) must finish within the timeout. */
  async function exchange(url: string, init: RequestInit): Promise<Exchange> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve("timeout");
      }, timeoutMs);
    });
    try {
      const request = (async () => {
        const response = await fetchFn(url, { ...init, signal: controller.signal });
        return { status: response.status, text: await response.text() };
      })();
      const outcome = await Promise.race([request, timedOut]);
      if (outcome === "timeout") return { failure: `timed out after ${timeoutMs} ms` };
      return outcome;
    } catch (error) {
      return { failure: error instanceof Error ? error.name : "error" };
    } finally {
      clearTimeout(timer);
    }
  }

  function postService(path: string, body: unknown): Promise<Exchange> {
    return exchange(baseUrl + path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.serviceCredential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  async function askKeyCheck(key: string): Promise<StudentKeyCheck> {
    const unavailable = (cause: string): StudentKeyCheck => {
      log(`[router-gateway] Key Check unavailable (${cause}) for key ${keyPrefix(key)}`);
      return { ok: false, reason: "unavailable", message: UNAVAILABLE_NOTICE };
    };
    const outcome = await postService(KEY_CHECK_PATH, { api_key: key });
    if ("failure" in outcome) return unavailable(outcome.failure);
    if (outcome.status !== 200) return unavailable(`HTTP ${outcome.status}`);
    return readKeyCheck(outcome.text) ?? unavailable("unreadable answer");
  }

  async function askClasses(userId: number): Promise<TeacherClasses> {
    const unavailable = (cause: string): TeacherClasses => {
      log(`[router-gateway] class lookup unavailable (${cause}) for user ${userId}`);
      return { ok: false, reason: "unavailable" };
    };
    const outcome = await postService(TEACHER_CLASSES_PATH, { user_id: userId });
    if ("failure" in outcome) return unavailable(outcome.failure);
    if (outcome.status !== 200) return unavailable(`HTTP ${outcome.status}`);
    return readClasses(outcome.text) ?? unavailable("unreadable answer");
  }

  async function getJson(url: string): Promise<Record<string, unknown> | string> {
    const outcome = await exchange(url, { method: "GET", headers: { accept: "application/json" } });
    if ("failure" in outcome) return outcome.failure;
    if (outcome.status !== 200) return `HTTP ${outcome.status}`;
    return parseObject(outcome.text) ?? "unreadable answer";
  }

  return {
    async checkStudentKey(rawKey) {
      const key = (rawKey ?? "").trim();
      if (!key.startsWith(KEY_PREFIX)) {
        return { ok: false, reason: "invalid", message: INVALID_NOTICE };
      }
      const digest = createHash("sha256").update(key).digest("hex");
      const cached = passes.get(digest);
      if (cached && now() < cached.until) return { ok: true, student: cached.student };

      const answer = await askKeyCheck(key);
      if (answer.ok) {
        const t = now();
        for (const [d, pass] of passes) if (t >= pass.until) passes.delete(d);
        passes.set(digest, { student: answer.student, until: t + PASS_CACHE_MS });
      }
      return answer;
    },

    async teacherClasses(userId) {
      const cached = classLookups.get(userId);
      if (cached && now() < cached.until) return cached.answer;
      const answer = await askClasses(userId);
      if (answer.ok) {
        const t = now();
        for (const [id, entry] of classLookups) if (t >= entry.until) classLookups.delete(id);
        classLookups.set(userId, { answer, until: t + CLASSES_CACHE_MS });
      }
      return answer;
    },

    teacherLoginUrl({ redirectUri, state, codeChallenge }) {
      const url = new URL(baseUrl + AUTHORIZE_PATH);
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: TEACHER_OAUTH_SCOPE,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }).toString();
      return url.toString();
    },

    async completeTeacherLogin({ code, codeVerifier, redirectUri }) {
      const unavailable = (cause: string): TeacherLogin => {
        log(`[router-gateway] teacher login unavailable (${cause})`);
        return { ok: false, reason: "unavailable" };
      };
      const refused = (cause: string): TeacherLogin => {
        log(`[router-gateway] teacher login refused (${cause})`);
        return { ok: false, reason: "invalid" };
      };

      const discovery = await getJson(baseUrl + DISCOVERY_PATH);
      if (typeof discovery === "string") return unavailable(`discovery: ${discovery}`);
      const { issuer, token_endpoint: tokenEndpoint, jwks_uri: jwksUri } = discovery;
      if (typeof issuer !== "string" || typeof tokenEndpoint !== "string" || typeof jwksUri !== "string") {
        return unavailable("discovery: unreadable answer");
      }

      const token = await exchange(tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: codeVerifier,
        }).toString(),
      });
      if ("failure" in token) return unavailable(`token: ${token.failure}`);
      if (token.status === 400 || token.status === 401) return refused(`token: HTTP ${token.status}`);
      if (token.status !== 200) return unavailable(`token: HTTP ${token.status}`);
      const idToken = parseObject(token.text)?.id_token;
      if (typeof idToken !== "string") return unavailable("token: no id_token");

      const jwks = await getJson(jwksUri);
      if (typeof jwks === "string") return unavailable(`jwks: ${jwks}`);
      if (!Array.isArray(jwks.keys)) return unavailable("jwks: unreadable answer");

      const claims = verifyIdToken(idToken, {
        issuer,
        audience: clientId,
        now: now(),
        keys: jwks.keys as JsonWebKey[],
      });
      if (!claims) return refused("ID token signature or claims");
      const sub = claims.sub;
      if (typeof sub !== "string" || !/^\d+$/.test(sub)) return refused("ID token sub");
      const userId = Number(sub);
      const displayName =
        typeof claims.name === "string" && claims.name.trim() !== "" ? claims.name : `教師 ${userId}`;
      return { ok: true, teacher: { userId, displayName } };
    },
  };
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Parses a Key Check 200 body; `null` when it does not match the contract. */
function readKeyCheck(text: string): StudentKeyCheck | null {
  const b = parseObject(text);
  if (!b) return null;

  if (b.accepted === false) {
    if (typeof b.message !== "string" || typeof b.reason !== "string") return null;
    const reason = (ROUTER_REASONS as readonly string[]).includes(b.reason)
      ? (b.reason as RefusalReason)
      : "invalid";
    return { ok: false, reason, message: b.message };
  }
  if (b.accepted !== true) return null;
  if (b.kind === "personal") {
    return { ok: false, reason: "not_a_student", message: NOT_A_STUDENT_NOTICE };
  }
  if (b.kind !== "classroom") return null;
  const studentId = b.student_id;
  const classId = b.class_id;
  const classSessionId = b.class_session_id;
  if (!isInt(studentId) || !isInt(classId) || !isInt(classSessionId)) return null;
  // display_name arrives with router ADR 0095; until then fall back to the id.
  const displayName =
    typeof b.display_name === "string" && b.display_name.trim() !== ""
      ? b.display_name
      : `學生 ${studentId}`;
  return { ok: true, student: { studentId, classId, classSessionId, displayName } };
}

/** Parses a class lookup 200 body; a refusal means no 班級. `null` when unreadable. */
function readClasses(text: string): TeacherClasses | null {
  const b = parseObject(text);
  if (!b) return null;
  if (b.accepted === false) return { ok: true, isAdmin: false, classes: [] };
  if (typeof b.is_admin !== "boolean" || !Array.isArray(b.classes)) return null;
  const classes: ClassRef[] = [];
  for (const c of b.classes as unknown[]) {
    if (typeof c !== "object" || c === null) return null;
    const { id, name } = c as Record<string, unknown>;
    if (!isInt(id) || typeof name !== "string") return null;
    classes.push({ id, name });
  }
  return { ok: true, isAdmin: b.is_admin, classes };
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}
