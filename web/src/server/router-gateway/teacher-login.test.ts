import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRouterGateway } from "./real";

const ROUTER = "https://router.test";
const NOW_MS = Date.UTC(2026, 11, 9, 4, 0, 0);
const NOW_S = NOW_MS / 1000;

const routerKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
const strangerKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ecKey = generateKeyPairSync("ec", { namedCurve: "P-256" });

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

function idToken(
  claims: Record<string, unknown>,
  opts: { key?: KeyObject; kid?: string; alg?: "RS256" | "ES256" } = {},
) {
  const alg = opts.alg ?? "RS256";
  const head = b64({ alg, typ: "JWT", kid: opts.kid ?? "router-1" });
  const body = b64(claims);
  const key = opts.key ?? routerKey.privateKey;
  const signature = sign(
    "sha256",
    Buffer.from(`${head}.${body}`),
    alg === "ES256" ? { key, dsaEncoding: "ieee-p1363" } : key,
  );
  return `${head}.${body}.${signature.toString("base64url")}`;
}

const goodClaims = {
  iss: ROUTER,
  aud: "club-booking-admin",
  sub: "42",
  name: "林老師",
  iat: NOW_S - 5,
  exp: NOW_S + 300,
};

type Call = { url: string; init: RequestInit };

/** A router serving discovery, JWKS and a token endpoint that returns `tokenAnswer`. */
function oidcRouter(tokenAnswer: () => Response) {
  const calls: Call[] = [];
  const jwks = {
    keys: [
      { ...routerKey.publicKey.export({ format: "jwk" }), kid: "router-1", alg: "RS256", use: "sig" },
      { ...ecKey.publicKey.export({ format: "jwk" }), kid: "router-ec", alg: "ES256", use: "sig" },
    ],
  };
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init: init ?? {} });
    if (u === `${ROUTER}/.well-known/openid-configuration`) {
      return Response.json({
        issuer: ROUTER,
        authorization_endpoint: `${ROUTER}/oauth/authorize`,
        token_endpoint: `${ROUTER}/oauth/token`,
        jwks_uri: `${ROUTER}/oauth/jwks`,
      });
    }
    if (u === `${ROUTER}/oauth/jwks`) return Response.json(jwks);
    if (u === `${ROUTER}/oauth/token`) return tokenAnswer();
    return new Response("not found", { status: 404 });
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
}

const tokenWith = (token: string) => () =>
  Response.json({ access_token: "ignored", token_type: "Bearer", id_token: token });

function gatewayFor(fetchFn: typeof fetch) {
  return createRouterGateway({
    routerUrl: ROUTER,
    serviceCredential: "svc-secret",
    fetch: fetchFn,
    now: () => NOW_MS,
    log: () => {},
  });
}

const finish = { code: "abc", codeVerifier: "verifier-123", redirectUri: "https://app.test/auth/callback" };

describe("router gateway teacherLoginUrl", () => {
  it("sends the teacher to the router's /oauth/authorize with PKCE and scope `openid teacher`", () => {
    const url = new URL(
      gatewayFor(oidcRouter(tokenWith("")).fetchFn).teacherLoginUrl({
        redirectUri: "https://app.test/auth/callback",
        state: "st",
        codeChallenge: "ch",
      }),
    );
    expect(url.origin + url.pathname).toBe(`${ROUTER}/oauth/authorize`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "club-booking-admin",
      redirect_uri: "https://app.test/auth/callback",
      scope: "openid teacher",
      state: "st",
      code_challenge: "ch",
      code_challenge_method: "S256",
    });
  });
});

describe("router gateway completeTeacherLogin", () => {
  it("exchanges the code with the PKCE verifier and returns the teacher from a valid ID token", async () => {
    const router = oidcRouter(tokenWith(idToken(goodClaims)));

    const result = await gatewayFor(router.fetchFn).completeTeacherLogin(finish);

    expect(result).toEqual({ ok: true, teacher: { userId: 42, displayName: "林老師" } });
    const tokenCall = router.calls.find((c) => c.url === `${ROUTER}/oauth/token`)!;
    expect(tokenCall.init.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(String(tokenCall.init.body)))).toEqual({
      grant_type: "authorization_code",
      code: "abc",
      redirect_uri: "https://app.test/auth/callback",
      client_id: "club-booking-admin",
      code_verifier: "verifier-123",
    });
  });

  it("accepts an ES256 ID token", async () => {
    const token = idToken(goodClaims, { key: ecKey.privateKey, kid: "router-ec", alg: "ES256" });
    expect(await gatewayFor(oidcRouter(tokenWith(token)).fetchFn).completeTeacherLogin(finish)).toMatchObject({
      ok: true,
    });
  });

  it.each([
    ["signed by another key", idToken(goodClaims, { key: strangerKey.privateKey })],
    ["for another audience", idToken({ ...goodClaims, aud: "agent-builder" })],
    ["from another issuer", idToken({ ...goodClaims, iss: "https://evil.test" })],
    ["expired", idToken({ ...goodClaims, exp: NOW_S - 120 })],
    ["with a non-numeric sub", idToken({ ...goodClaims, sub: "alice" })],
    ["tampered after signing", idToken(goodClaims).replace(/\.[^.]+\./, `.${b64({ ...goodClaims, sub: "1" })}.`)],
    ["unsigned (alg none)", `${b64({ alg: "none" })}.${b64(goodClaims)}.`],
  ])("refuses an ID token %s", async (_, token) => {
    const result = await gatewayFor(oidcRouter(tokenWith(token)).fetchFn).completeTeacherLogin(finish);
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses when the router rejects the code (invalid_grant)", async () => {
    const router = oidcRouter(() => Response.json({ error: "invalid_grant" }, { status: 400 }));
    expect(await gatewayFor(router.fetchFn).completeTeacherLogin(finish)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("is unavailable when the router errors", async () => {
    const router = oidcRouter(() => new Response("boom", { status: 502 }));
    expect(await gatewayFor(router.fetchFn).completeTeacherLogin(finish)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
