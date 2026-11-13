import { createHash } from "node:crypto";
import {
  INVALID_NOTICE,
  KEY_PREFIX,
  NOT_A_STUDENT_NOTICE,
  UNAVAILABLE_NOTICE,
  keyPrefix,
  type RefusalReason,
  type RouterGateway,
  type Student,
  type StudentKeyCheck,
} from "./types";

const KEY_CHECK_PATH = "/internal/key-check";
const PASS_CACHE_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 3_000;
const ROUTER_REASONS: readonly RefusalReason[] = ["invalid", "disabled", "not_started", "expired"];

export type RouterGatewayOptions = {
  routerUrl: string;
  serviceCredential: string;
  fetch?: typeof fetch;
  /** Milliseconds; injectable so cache expiry can be tested. */
  now?: () => number;
  timeoutMs?: number;
  log?: (line: string) => void;
};

/** Real gateway: calls the router's Key Check (router ADR 0079/0082/0095). */
export function createRouterGateway(options: RouterGatewayOptions): RouterGateway {
  const baseUrl = options.routerUrl.replace(/\/+$/, "");
  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = options.log ?? ((line: string) => console.error(line));
  // SHA-256 of the key -> accepted student and expiry. Never the key itself.
  const passes = new Map<string, { student: Student; until: number }>();

  function unavailable(key: string, cause: string): StudentKeyCheck {
    log(`[router-gateway] Key Check unavailable (${cause}) for key ${keyPrefix(key)}`);
    return { ok: false, reason: "unavailable", message: UNAVAILABLE_NOTICE };
  }

  async function askRouter(key: string): Promise<StudentKeyCheck> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve("timeout");
      }, timeoutMs);
    });
    try {
      // The whole exchange (headers and body) must finish within the timeout.
      const exchange = (async () => {
        const response = await fetchFn(baseUrl + KEY_CHECK_PATH, {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.serviceCredential}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ api_key: key }),
          signal: controller.signal,
        });
        return { status: response.status, text: await response.text() };
      })();
      const outcome = await Promise.race([exchange, timedOut]);
      if (outcome === "timeout") return unavailable(key, `timed out after ${timeoutMs} ms`);
      if (outcome.status !== 200) return unavailable(key, `HTTP ${outcome.status}`);
      const answer = readAnswer(outcome.text);
      return answer ?? unavailable(key, "unreadable answer");
    } catch (error) {
      return unavailable(key, error instanceof Error ? error.name : "error");
    } finally {
      clearTimeout(timer);
    }
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

      const answer = await askRouter(key);
      if (answer.ok) {
        const t = now();
        for (const [d, pass] of passes) if (t >= pass.until) passes.delete(d);
        passes.set(digest, { student: answer.student, until: t + PASS_CACHE_MS });
      }
      return answer;
    },
  };
}

/** Parses a Key Check 200 body; `null` when it does not match the contract. */
function readAnswer(text: string): StudentKeyCheck | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

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

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}
