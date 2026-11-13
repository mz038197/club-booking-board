import { createFakeGateway } from "./fake";
import { createRouterGateway } from "./real";
import type { RouterGateway } from "./types";

export * from "./types";

type Env = Record<string, string | undefined>;

/** ROUTER_GATEWAY=fake selects the fake gateway (refused in production). */
export function gatewayFromEnv(env: Env): RouterGateway {
  if (env.ROUTER_GATEWAY === "fake") return createFakeGateway(env);
  if (!env.ROUTER_URL || !env.ROUTER_SERVICE_CREDENTIAL) {
    throw new Error("ROUTER_URL and ROUTER_SERVICE_CREDENTIAL must be set (or ROUTER_GATEWAY=fake).");
  }
  return createRouterGateway({
    routerUrl: env.ROUTER_URL,
    serviceCredential: env.ROUTER_SERVICE_CREDENTIAL,
    oauthClientId: env.ROUTER_OAUTH_CLIENT_ID || undefined,
  });
}
