/**
 * The consent step and the upstream sign-in through Cloudflare Access, as
 * @dustinedwards/site-runtime/mcp-login runs it for every admin MCP server.
 * This file is Foxing Admin's configuration of it: its name, its scopes, its
 * consent paragraphs and who is let in (the single ADMIN_EMAIL).
 *
 * Access rather than Foxing's own Better Auth: this server's sign-in stays
 * independent of foxing.app's sessions. The Foxing account the API acts as is
 * FOXING_ADMIN_ID, and the API re-checks that account's admin standing (ADMIN_EMAILS) on every call.
 */

import { auditLogCheck, type AuditEnv } from "@dustinedwards/site-runtime/audit-log";
import { durableObjectCheck, healthResponse, kvCheck, r2Check, type HealthCheck } from "@dustinedwards/site-runtime/health";
import { isAdminUser, loginHandler, type LoginEnv as SharedLoginEnv } from "@dustinedwards/site-runtime/mcp-login";
import type { Env } from "./api-handler";
import { SCOPE_READ, SCOPE_WRITE } from "./auth";
import { SERVER_INFO } from "./mcp-handler";

export interface LoginEnv extends SharedLoginEnv, Partial<AuditEnv> {
  ADMIN_EMAIL?: string;
  /** The deployed commit, set by CI's deploy (--var DEPLOY_SHA) and reported by /health. */
  DEPLOY_SHA?: string;
}

export const defaultHandler = loginHandler<LoginEnv>({
  name: "Foxing Admin",
  scopes: { read: SCOPE_READ, write: SCOPE_WRITE },
  about: `<p>Foxing Admin runs foxing.app: the platform snapshot, readers, the catalog and
staff picks, Book of the Month, celebrity picks and the admin audit log. It cannot
write Journal posts; Carrel owns writing.</p>
<p>It will always be able to read. Changes need the box below.</p>`,
  admit: isAdminUser,
  // Every sign-in, admitted or refused, is a row in the tool-call log.
  audit: { name: SERVER_INFO.name, version: SERVER_INFO.version },
  // CI's deploy (devkit's worker-deploy.yml) passes DEPLOY_SHA and waits for /health to report it.
  // site-runtime's healthResponse: application/health+json, no-store and noindex, with a check per binding and the
  // tool-call log's own (L8, a warn-level alert: a call with no finished row, a spike, or rows not copied for two days).
  health: (env) => healthResponse({ sha: env.DEPLOY_SHA, checks: [...healthChecks(env as unknown as Env), auditLogCheck(env)] }),
});

/**
 * One check per binding in wrangler.jsonc.example. Every one but audit-bucket is level fail: without OAUTH_KV no token is checked,
 * without FOXING no tool reaches the admin API, without MCP_RATE_LIMIT every /mcp call is a 429 (it fails closed) and
 * without TOOL_CALL_LOG every tool call is refused. The service binding is checked by presence only: a request over
 * it would be an admin API call. The Durable Object checks mint an id and wake no object.
 */
function healthChecks(env: Env): HealthCheck[] {
  const foxing: HealthCheck = {
    name: "foxing",
    run: async () => typeof env.FOXING?.fetch === "function" || { ok: false, detail: "binding missing" },
  };
  return [
    ...[
      kvCheck("oauth-kv", env.OAUTH_KV),
      foxing,
      durableObjectCheck("mcp-rate-limit", env.MCP_RATE_LIMIT),
      durableObjectCheck("tool-call-log-binding", env.TOOL_CALL_LOG),
    ].map((check) => ({ ...check, level: "fail" as const })),
    // AUDIT_BUCKET holds only the nightly copies of the tool-call log, so a bucket that fails to answer warns and
    // never takes the Worker to 503. One `head` of a fixed key, never a list.
    { ...r2Check("audit-bucket", env.AUDIT_BUCKET as R2Bucket), level: "warn" as const },
  ];
}
