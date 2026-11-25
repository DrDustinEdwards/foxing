/**
 * Foxing Admin: the admin MCP server. Its own Worker: no Stripe key, no D1, no Foxing data binding (its one R2 bucket holds copies of its own
 * tool-call log). Its only route to Foxing is the FOXING service binding to /api/v1/admin, which owns every rule and re-checks the acting admin on every call.
 * It is site-runtime's adminMcpWorker, the shared door (Origin/Host checks, OAuth, Cloudflare Access sign-in for the single ADMIN_EMAIL, rate limit,
 * /owner, /health); Foxing's own parts are its name, consent text, binding and MCP server (mcp-handler.ts). Access rather than Foxing's Better Auth
 * keeps this sign-in independent of foxing.app sessions. The account the API acts as is FOXING_ADMIN_ID.
 */

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { privateRobotsResponse } from "@drdustinedwards/site-helpers/robots";
import { adminMcpWorker, type AdminMcpEnv } from "@dustinedwards/site-runtime/admin-mcp";
import { foxingMcp } from "@dustinedwards/site-runtime/sites";

import type { ApiEnv } from "./api-client";
import { handleMcp, SERVER } from "./mcp-handler";

export { RateLimiter as McpRateLimit } from "@dustinedwards/site-runtime/rate-limit/durable-object";
export { ToolCallLog } from "@dustinedwards/site-runtime/audit-log";

export interface Env extends AdminMcpEnv, Partial<ApiEnv> {}

export default adminMcpWorker<Env>({
  name: "Foxing Admin",
  server: SERVER,
  site: foxingMcp,
  securityTxt: { contact: "security@dustinedwards.info", expires: "2027-09-28T00:00:00Z" },
  about: `<p>Foxing Admin runs foxing.app: the platform snapshot, readers, the catalog and
staff picks, Book of the Month, celebrity picks and the admin audit log. It cannot
write Journal posts; Carrel owns writing.</p>
<p>It will always be able to read. Changes need the box below.</p>`,
  // The service binding is checked by presence only: a request over it would be an admin API call.
  api: { binding: "FOXING", name: "foxing" },
  OAuthProvider,
  serve: (request, env, ctx, caller) => handleMcp(request, env, ctx, caller),
  // The door is for machines: its robots.txt is Prelum's private-host response, Disallow: / for every crawler.
  routes: (request) =>
    new URL(request.url).pathname === "/robots.txt" ? privateRobotsResponse() : null,
});
