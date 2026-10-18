/**
 * The authenticated MCP surface, apart from the OAuth library so it is testable
 * on its own. The provider has validated the access token by the time this
 * runs; the audience and the administrator are checked AGAIN here, because a
 * grant is long lived and this is the boundary a request actually crosses.
 */

import type { ApiEnv } from "./api-client";
import type { AuditEnv } from "./audit-log";
import { isAdminUser, SCOPE_READ, type Props } from "./auth";
import type { LoginEnv } from "./login-handler";
import { handleMcp, MCP_ROUTE } from "./mcp-handler";
import { checkRateLimit, type RateLimitEnv } from "./rate-limit";

export interface Env
  extends Partial<ApiEnv>,
    Partial<RateLimitEnv>,
    Partial<AuditEnv>,
    Omit<LoginEnv, "OAUTH_PROVIDER"> {
  OAUTH_KV: KVNamespace;
  /** The one public origin. Every access token is bound to its /mcp (RFC 8707). */
  PUBLIC_ORIGIN?: string;
  /** Comma-separated redirect URIs a dynamically registered client may use, matched exactly. */
  DCR_REDIRECT_URIS?: string;
}

/** The configured origin, or "" when unset. There is no default: an unset origin serves nothing. */
export function publicOrigin(env: Pick<Env, "PUBLIC_ORIGIN">): string {
  return (env.PUBLIC_ORIGIN?.trim() ?? "").replace(/\/+$/, "");
}

export function refuse(body: string, status: number, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      ...headers,
    },
  });
}

export const apiHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { props, auth } = ctx as ExecutionContext & {
      props?: Props;
      auth?: { audience?: string; scope?: string[] };
    };
    // Rule 12.2: a token not issued for this server is refused, even if a
    // provider configured for a second resource ever handed one over.
    if (auth?.audience !== `${publicOrigin(env)}${MCP_ROUTE}`) {
      console.warn(JSON.stringify({ door: "refused", reason: "audience", audience: auth?.audience ?? null }));
      return refuse("Forbidden. This token was not issued for Foxing Admin.", 403);
    }
    if (!props || !isAdminUser(env, props)) {
      return refuse(
        "Forbidden. This is a single-administrator server and this grant does not belong to its administrator.",
        403,
      );
    }
    const limit = await checkRateLimit(env, `admin:${props.email.toLowerCase()}`);
    if (!limit.allowed) {
      return refuse(
        "Rate limited. This server allows 30 requests per 60 seconds. The Foxing admin API applies its own limit as well.",
        429,
        { "retry-after": String(limit.retryAfter) },
      );
    }
    const scopes = Array.isArray(auth.scope) ? auth.scope : [SCOPE_READ];
    return handleMcp(request, env, ctx, { kind: "admin", props, scopes });
  },
};

