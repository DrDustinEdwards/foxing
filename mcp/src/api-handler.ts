/**
 * The authenticated MCP surface, apart from the OAuth library so it is testable
 * on its own. The provider has validated the access token by the time this
 * runs; the audience and the administrator are checked AGAIN here, because a
 * grant is long lived and this is the boundary a request actually crosses.
 */

import { recordAudit, type AuditEnv } from "@dustinedwards/site-runtime/audit-log";
import { isAdminUser } from "@dustinedwards/site-runtime/mcp-login";
import { audienceRefusal, checkRateLimit, refuse } from "@dustinedwards/site-runtime/mcp-server";
import type { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

import type { ApiEnv } from "./api-client";
import { SCOPE_READ, type Props } from "./auth";
import type { LoginEnv } from "./login-handler";
import { handleMcp, MCP_ROUTE, SERVER_INFO } from "./mcp-handler";


export interface Env
  extends Partial<ApiEnv>,
    Partial<AuditEnv>,
    Omit<LoginEnv, "OAUTH_PROVIDER"> {
  OAUTH_KV: KVNamespace;
  /** The door's limiter (index.ts exports the Durable Object as McpRateLimit). */
  MCP_RATE_LIMIT?: DurableObjectNamespace<RateLimiter>;
  /** The one public origin. Every access token is bound to its /mcp (RFC 8707). */
  PUBLIC_ORIGIN?: string;
  /** Comma-separated redirect URIs a dynamically registered client may use, matched exactly. */
  DCR_REDIRECT_URIS?: string;
}

/** The configured origin, or "" when unset. There is no default: an unset origin serves nothing. */
export function publicOrigin(env: Pick<Env, "PUBLIC_ORIGIN">): string {
  return (env.PUBLIC_ORIGIN?.trim() ?? "").replace(/\/+$/, "");
}

export const apiHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { props, auth } = ctx as ExecutionContext & {
      props?: Props;
      auth?: { audience?: string; scope?: string[] };
    };
    // Rule 12.2: a token not issued for this server is refused, even if a
    // provider configured for a second resource ever handed one over.
    const wrongAudience = audienceRefusal(auth, `${publicOrigin(env)}${MCP_ROUTE}`, [SCOPE_READ]);
    if (wrongAudience) return wrongAudience;
    if (!props || !isAdminUser(env, props)) {
      return refuse(
        "Forbidden. This is a single-administrator server and this grant does not belong to its administrator.",
        403,
      );
    }
    const limit = await checkRateLimit(env.MCP_RATE_LIMIT, `admin:${props.email.toLowerCase()}`);
    if (!limit.allowed) {
      // A rate-limited request is a row in the tool-call log beside the calls and sign-ins (checklist L2).
      await recordAudit(env, {
        callId: crypto.randomUUID(),
        phase: "rate-limited",
        caller: `access:${props.email}`,
        clientId: typeof props.clientId === "string" ? props.clientId : undefined,
        server: { name: SERVER_INFO.name, version: SERVER_INFO.version },
      });
      return refuse(
        "Rate limited. This server allows 30 requests per 60 seconds. The Foxing admin API applies its own limit as well.",
        429,
        { "retry-after": String(limit.retryAfter) },
      );
    }
    // A grant with no scope list is refused, not read as read-only (Grok audit 2026-10-21, FX-16).
    if (!Array.isArray(auth?.scope)) return refuse("This grant carries no scope. Sign in again.", 403);
    const scopes = auth.scope;
    return handleMcp(request, env, ctx, { kind: "admin", props, scopes });
  },
};

