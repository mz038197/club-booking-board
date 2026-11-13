import { createHash, randomBytes } from "node:crypto";
import type { Db } from "./db";
import { sessionCols, toSession, type Session, type SessionRow } from "./sessions";

/**
 * 學生分享連結 (ADR 0005): a long random token that opens the read-only 看板 of one
 * 堂課 without login. At most one live link per 堂課; only the token's SHA-256 and
 * the expiry are stored. Lifetime: SHARE_LINK_HOURS after it was made.
 */

export const SHARE_LINK_HOURS = 12;

/** Shown for an unknown, replaced, closed or expired 分享連結. */
export const SHARE_LINK_GONE = "這個分享連結已失效，請向老師索取新的連結";

export type ShareLinkStatus = { createdAt: Date; expiresAt: Date };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Token shape: 32 random bytes as base64url (43 chars). */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Makes a new link for the 堂課, replacing (and so killing) any previous one. Returns the token. */
export async function createShareLink(
  db: Db,
  sessionId: string,
  now: Date,
): Promise<{ token: string } & ShareLinkStatus> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SHARE_LINK_HOURS * 3600_000);
  await db.query(
    `INSERT INTO share_links (session_id, token_hash, created_at, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (session_id) DO UPDATE
       SET token_hash = EXCLUDED.token_hash, created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at`,
    [sessionId, hashToken(token), now.toISOString(), expiresAt.toISOString()],
  );
  return { token, createdAt: now, expiresAt };
}

/** The 堂課's live (unexpired) link, without its token; null when there is none. */
export async function shareLinkOf(db: Db, sessionId: string, now: Date): Promise<ShareLinkStatus | null> {
  const [row] = await db.query<{ created_at: Date | string; expires_at: Date | string }>(
    "SELECT created_at, expires_at FROM share_links WHERE session_id = $1 AND expires_at > $2",
    [sessionId, now.toISOString()],
  );
  return row ? { createdAt: new Date(row.created_at), expiresAt: new Date(row.expires_at) } : null;
}

/** Closes the 堂課's link (no-op when there is none). */
export async function closeShareLink(db: Db, sessionId: string): Promise<void> {
  await db.query("DELETE FROM share_links WHERE session_id = $1", [sessionId]);
}

/** The 堂課 a live token opens; null for unknown, malformed, replaced, closed or expired tokens. */
export async function sessionOfShareToken(db: Db, token: string, now: Date): Promise<Session | null> {
  if (!TOKEN.test(token)) return null;
  const [row] = await db.query<SessionRow>(
    `SELECT ${sessionCols("s")}
       FROM share_links l JOIN sessions s ON s.id = l.session_id
      WHERE l.token_hash = $1 AND l.expires_at > $2`,
    [hashToken(token), now.toISOString()],
  );
  return row ? toSession(row) : null;
}
