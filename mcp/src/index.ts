/**
 * Foxing Admin: the admin MCP server for foxing.app.
 *
 * Ruling capsid/rulings/mcp-2026-10-10.md and capsid/research/design-mcp-servers.md
 * section 5. Its own Worker (rule 9 as amended): it holds no Stripe key, no D1,
 * no R2 and no Foxing data binding. Its only route to Foxing is the FOXING
 * service binding to /api/v1/admin, which owns every rule and re-checks the
 * acting admin on every call. If this Worker vanished, nothing about what is
 * allowed on foxing.app would change.
 *
 * Request routing, outermost first:
 *
 *   /mcp                   a foreign Origin is refused, then the provider
 *                          validates the access token, then
 *                          apiHandler checks the audience, re-checks the
 *                          administrator, rate limits and hands off
 *   /authorize /callback   consent and the Cloudflare Access sign-in, login-handler.ts
 *   /register              site-runtime's registrationLimited (per address and
 *                          overall), then the provider, which refuses any
 *                          redirect URI not allowlisted exactly
 *   /token, /.well-known/* the provider
 *   /health                liveness and the deployed commit (login-handler.ts)
 */

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { DCR_CALLBACKS, registrationLimited, registrationRefusal } from "@dustinedwards/site-runtime/mcp-login";
import { checkRateLimit, mcpOriginRefusal, refuse, withMcpHeaders } from "@dustinedwards/site-runtime/mcp-server";
import { foxingMcp } from "@dustinedwards/site-runtime/sites";

import { apiHandler, publicOrigin, type Env } from "./api-handler";
import { SCOPES } from "./auth";
import { defaultHandler } from "./login-handler";
import { MCP_ROUTE } from "./mcp-handler";

export { RateLimiter as McpRateLimit } from "@dustinedwards/site-runtime/rate-limit/durable-object";
export { ToolCallLog } from "@dustinedwards/site-runtime/audit-log";

export type { Env };

const providers = new Map<string, OAuthProvider<Env>>();

/**
 * One provider per origin and registration allowlist: both are fixed at
 * construction, so a changed allowlist gets a new provider, never a stale one.
 */
function providerFor(env: Env): OAuthProvider<Env> {
  const origin = publicOrigin(env);
  const key = `${origin} ${env.DCR_REDIRECT_URIS ?? ""}`;
  let provider = providers.get(key);
  if (!provider) {
    provider = new OAuthProvider<Env>({
      apiRoute: MCP_ROUTE,
      apiHandler,
      defaultHandler: defaultHandler as unknown as ExportedHandler<Env>,
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/token",
      scopesSupported: SCOPES.all,
      // AUDIENCE BINDING, rule 12.2 and RFC 8707: every grant and token is
      // pinned to exactly this server's /mcp. Nothing is passed through; the
      // API leg uses ADMIN_OPERATOR_TOKEN, never the client's token.
      resourceMetadata: {
        resource: `${origin}${MCP_ROUTE}`,
        authorization_servers: [origin],
        scopes_supported: SCOPES.all,
        resource_name: "Foxing Admin",
      },
      // Rule 13. CIMD for Claude, Claude Code and ChatGPT, which send their
      // client_id as a metadata URL and never register. Needs the
      // global_fetch_strictly_public compatibility flag.
      clientIdMetadataDocumentEnabled: true,
      // Tightened DCR for Grok and Gemini, which still require RFC 7591 as of
      // 2026-10-09: exact redirect URIs only, rate limited before the provider
      // sees it, and a registration grants nothing (consent, Access and
      // isAdminUser still decide). Remove when they support CIMD, at the latest
      // when the specification removes DCR.
      clientRegistrationEndpoint: "/register",
      clientRegistrationCallback: ({ clientMetadata }) => {
        // The callbacks every user shares (Grok, ChatGPT, Gemini) and this server's own DCR_REDIRECT_URIS.
        const why = registrationRefusal([...DCR_CALLBACKS, env.DCR_REDIRECT_URIS].join(","), clientMetadata);
        if (!why) return undefined;
        console.log(JSON.stringify({ audit: "registration-refused", why }));
        return { code: "invalid_redirect_uri", description: why };
      },
    });
    providers.set(key, provider);
  }
  return provider;
}

// Every response, 404s included, leaves with the family set, noindex, no-store and the consent page's policy; the
// wrapper also answers /.well-known/security.txt and /csp-report.
export default {
  fetch: withMcpHeaders<Env>((request, env, ctx) => route(request, env, ctx as ExecutionContext), {
    site: foxingMcp,
    securityTxt: { contact: "security@dustinedwards.info", expires: "2027-09-28T00:00:00Z" },
    allowReport: async (request, env) =>
      (await checkRateLimit(env.MCP_RATE_LIMIT, `csp-report:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`)).allowed,
  }),
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  // Fails closed: tokens are bound to PUBLIC_ORIGIN + /mcp, so without it no
  // token could be checked against the right audience.
  if (!publicOrigin(env)) {
    return refuse("Foxing Admin is not configured: PUBLIC_ORIGIN is unset. Not configured means not open.", 503);
  }
  // Before the token check, so a page on another origin learns nothing from a 401 (DNS rebinding).
  if (url.pathname === MCP_ROUTE) {
    const foreign = mcpOriginRefusal(request);
    if (foreign) return foreign;
  }
  if (url.pathname === "/register" && request.method === "POST") {
    const limited = await registrationLimited(request, env.OAUTH_KV);
    if (limited) return limited;
  }
  return providerFor(env).fetch(request, env, ctx);
}
