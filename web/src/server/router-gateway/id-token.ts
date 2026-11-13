import { createPublicKey, verify, type JsonWebKey } from "node:crypto";

/** Allowed ID token algorithms; anything else (notably `none` and HS*) is refused. */
const ALGORITHMS: Record<string, { hash: string; ec: boolean }> = {
  RS256: { hash: "sha256", ec: false },
  ES256: { hash: "sha256", ec: true },
};
/** Clock skew tolerated for `exp` / `iat`. */
const LEEWAY_S = 60;

export type IdTokenCheck = {
  issuer: string;
  audience: string;
  /** Milliseconds. */
  now: number;
  /** The router's JWKS `keys`. */
  keys: JsonWebKey[];
};

/**
 * Verifies an OpenID Connect ID token's signature (RS256/ES256 against the
 * router's JWKS) and its `iss`, `aud`, `exp`. Returns the claims, or `null`.
 */
export function verifyIdToken(token: string, check: IdTokenCheck): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJson(headerPart);
  const claims = decodeJson(payloadPart);
  if (!header || !claims) return null;

  const alg = typeof header.alg === "string" ? ALGORITHMS[header.alg] : undefined;
  if (!alg) return null;
  const candidates = check.keys.filter(
    (k) => (header.kid === undefined || k.kid === header.kid) && (k.alg === undefined || k.alg === header.alg),
  );
  const signed = Buffer.from(`${headerPart}.${payloadPart}`);
  const signature = Buffer.from(signaturePart, "base64url");
  const valid = candidates.some((jwk) => {
    try {
      const key = createPublicKey({ key: jwk, format: "jwk" });
      return verify(alg.hash, signed, alg.ec ? { key, dsaEncoding: "ieee-p1363" } : key, signature);
    } catch {
      return false;
    }
  });
  if (!valid) return null;

  if (claims.iss !== check.issuer) return null;
  const aud = claims.aud;
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!audiences.includes(check.audience)) return null;
  if (Array.isArray(aud) && aud.length > 1 && claims.azp !== check.audience) return null;
  const nowS = check.now / 1000;
  if (typeof claims.exp !== "number" || claims.exp + LEEWAY_S <= nowS) return null;
  if (typeof claims.iat === "number" && claims.iat - LEEWAY_S > nowS) return null;
  return claims;
}

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
