/**
 * Public URLs shown to Agent Builder (OpenAPI `servers`, the Agent Builder 設定 card).
 * All configurable via env; see web/.env.example.
 */
type Env = Record<string, string | undefined>;

const DEFAULT_ROUTER_URL = "https://ai.vanscoding.com";
/** vans-mcp-server's OAuth entry (vans ADR 0004). */
const DEFAULT_MCP_URL = "https://mcp.vanscoding.com/mcp-oauth/";
/** OAuth Client registered in the router for Agent Builder (router ADR 0094). */
const DEFAULT_AGENT_BUILDER_CLIENT_ID = "agent-builder";

const trimSlash = (url: string) => url.replace(/\/+$/, "");
const set = (v: string | undefined): v is string => typeof v === "string" && v.trim() !== "";

/**
 * This app's public origin: PUBLIC_BASE_URL, else Vercel's production domain,
 * else the origin the request came in on.
 */
export function publicBaseUrl(env: Env, requestOrigin: string): string {
  if (set(env.PUBLIC_BASE_URL)) return trimSlash(env.PUBLIC_BASE_URL.trim());
  if (set(env.VERCEL_PROJECT_PRODUCTION_URL)) return `https://${trimSlash(env.VERCEL_PROJECT_PRODUCTION_URL.trim())}`;
  return trimSlash(requestOrigin);
}

/** Base URL of the student API: what Agent Builder calls `servers[0].url` / Base URL. */
export function studentApiBaseUrl(env: Env, requestOrigin: string): string {
  return `${publicBaseUrl(env, requestOrigin)}/api/v1`;
}

export type AgentBuilderSettings = {
  apiBaseUrl: string;
  mcpUrl: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope: "classroom";
  clientId: string;
};

/**
 * Values the teacher pastes into Agent Builder, once per space. Both the API tool and
 * the MCP Server use OAuth 2.0 (user authorization) against the router (router ADR 0094).
 */
export function agentBuilderSettings(env: Env, requestOrigin: string): AgentBuilderSettings {
  const router = trimSlash(
    (set(env.ROUTER_PUBLIC_URL) ? env.ROUTER_PUBLIC_URL : set(env.ROUTER_URL) ? env.ROUTER_URL : DEFAULT_ROUTER_URL).trim(),
  );
  return {
    apiBaseUrl: studentApiBaseUrl(env, requestOrigin),
    mcpUrl: set(env.MCP_SERVER_URL) ? env.MCP_SERVER_URL.trim() : DEFAULT_MCP_URL,
    authorizationUrl: set(env.AGENT_BUILDER_AUTHORIZATION_URL)
      ? env.AGENT_BUILDER_AUTHORIZATION_URL.trim()
      : `${router}/oauth/authorize`,
    tokenUrl: set(env.AGENT_BUILDER_TOKEN_URL) ? env.AGENT_BUILDER_TOKEN_URL.trim() : `${router}/oauth/token`,
    scope: "classroom",
    clientId: set(env.AGENT_BUILDER_CLIENT_ID) ? env.AGENT_BUILDER_CLIENT_ID.trim() : DEFAULT_AGENT_BUILDER_CLIENT_ID,
  };
}
