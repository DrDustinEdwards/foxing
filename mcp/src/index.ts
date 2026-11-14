/**
 * Foxing Admin: the admin MCP server for foxing.app.
 *
 * Ruling capsid/rulings/mcp-2026-10-10.md and capsid/research/design-mcp-servers.md section 5. Its own Worker (rule 9
 * as amended): it holds no Stripe key, no D1 and no Foxing data binding (its one R2 bucket holds only copies of its own
 * tool-call log). Its only route to Foxing is the FOXING service binding to /api/v1/admin, which owns every rule and
 * re-checks the acting admin on every call. If this Worker vanished, nothing about what is allowed on foxing.app would
 * change.
 *
 * The Worker is site-runtime's adminMcpWorker, the door every admin MCP server shares: the Origin and Host checks, the
 * list-only test key, the OAuth provider bound to PUBLIC_ORIGIN + /mcp, the Cloudflare Access sign-in admitting the
 * single ADMIN_EMAIL (on every request too), the rate limit, /owner, /health and the tool-call log's daily copy. What
 * is Foxing's own is below: its name, its consent paragraphs, its binding and its MCP server (mcp-handler.ts).
 *
 * Access rather than Foxing's own Better Auth: this server's sign-in stays independent of foxing.app's sessions. The
 * Foxing account the API acts as is FOXING_ADMIN_ID, and the API re-checks that account's admin standing (ADMIN_EMAIL and CO_OWNER_EMAILS)
 * on every call.
 */

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { robotsResponse } from "@drdustinedwards/site-helpers/robots";
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
  // The door is for machines: its robots.txt is Prelum's in the preview form, Disallow: / for every crawler.
  routes: (request) =>
    new URL(request.url).pathname === "/robots.txt"
      ? robotsResponse({ origin: new URL(request.url).origin, request, preview: true })
      : null,
});
