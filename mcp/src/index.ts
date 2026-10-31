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
 *   /mcp                   the provider validates the access token, then
 *                          apiHandler checks the audience, re-checks the
 *                          administrator, rate limits and hands off
 *   /authorize /callback   consent and the Cloudflare Access sign-in, login-handler.ts
 *   /register              site-runtime's registrationLimited (per address and
 *                          overall), then the provider, which refuses any
 *                          redirect URI not allowlisted exactly
 *   /token, /.well-known/* the provider
 *   /health                liveness
 */

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { buildPolicy, scriptHash } from "@dustinedwards/site-runtime/csp";
import { applyHeaderSet, buildSecurityHeaders } from "@dustinedwards/site-runtime/headers";
import { CONSENT_STYLE, DCR_CALLBACKS, registrationLimited, registrationRefusal } from "@dustinedwards/site-runtime/mcp-login";
import { refuse } from "@dustinedwards/site-runtime/mcp-server";

import { apiHandler, publicOrigin, type Env } from "./api-handler";
import { SCOPES } from "./auth";
import { defaultHandler } from "./login-handler";
import { MCP_ROUTE } from "./mcp-handler";

export { RateLimiter as McpRateLimit } from "@dustinedwards/site-runtime/rate-limit/durable-object";
export { ToolCallLog } from "@dustinedwards/site-runtime/audit-log";

export type { Env };

// EVERY RESPONSE LEAVES THROUGH withSecurityHeaders: the family's standard set
// (site-runtime, OWASP's values), never cached or indexed, and a policy that
// lets no page frame this one, so the consent page cannot be clickjacked.
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  ...buildSecurityHeaders(),
  "X-Robots-Tag": "noindex, nofollow",
};

/** Nothing here but the consent page is a page: the rest may load nothing. */
const NON_HTML_POLICY = buildPolicy(["default-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"]);

// The consent page's one inline <style>, by hash. No form-action: approving
// posts into a redirect chain ending at whatever redirect_uri the client named.
let consentPolicy: Promise<string> | undefined;

async function withSecurityHeaders(response: Response): Promise<Response> {
  const headers = new Headers(response.headers);
  applyHeaderSet(headers, SECURITY_HEADERS);
  if (!(headers.get("Cache-Control") ?? "").includes("no-store")) headers.set("Cache-Control", "no-store");
  const isHtml = (headers.get("Content-Type") ?? "").includes("text/html");
  consentPolicy ??= scriptHash(CONSENT_STYLE).then((hash) =>
    buildPolicy(["default-src 'none'", `style-src '${hash}'`, "base-uri 'none'", "frame-ancestors 'none'"]),
  );
  headers.set("Content-Security-Policy", isHtml ? await consentPolicy : NON_HTML_POLICY);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

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

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> =>
    withSecurityHeaders(await route(request, env, ctx)),
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  // Fails closed: tokens are bound to PUBLIC_ORIGIN + /mcp, so without it no
  // token could be checked against the right audience.
  if (!publicOrigin(env)) {
    return refuse("Foxing Admin is not configured: PUBLIC_ORIGIN is unset. Not configured means not open.", 503);
  }
  if (url.pathname === "/register" && request.method === "POST") {
    const limited = await registrationLimited(request, env.OAUTH_KV);
    if (limited) return limited;
  }
  return providerFor(env).fetch(request, env, ctx);
}
