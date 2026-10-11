/**
 * The consent step and the upstream GitHub sign-in.
 *
 * `@cloudflare/workers-oauth-provider` makes this Worker an OAuth 2.1
 * authorization server for MCP clients. It does not know WHO the human is, so
 * after consent this handler sends them to GitHub and checks the returning
 * account against the single configured administrator (ADMIN_GITHUB_LOGIN).
 *
 * The consent handle and the upstream state are the provider's own helpers
 * (beginConsent, approveConsent, beginUpstream, finishUpstream), as Carrel uses
 * them: each is bound to this browser by a cookie the library sets and works
 * once, so another site cannot submit consent or replay a callback.
 *
 * GitHub rather than Foxing's own Better Auth, as Capsid and Dustin Edwards
 * Admin do: this server's sign-in stays independent of foxing.app's sessions.
 * The Foxing account the API acts as is FOXING_ADMIN_ID, and the API re-checks
 * that account's is_admin on every call. A GitHub OAuth App with no scope: only
 * the identity is read.
 */

import {
  AuthorizationError,
  CimdFetchError,
  type AuthRequest,
  type ClientInfo,
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";

import { isAdminUser, SCOPE_READ, SCOPE_WRITE, type Props } from "./auth";

export interface GitHubEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  ADMIN_GITHUB_LOGIN?: string;
  PUBLIC_ORIGIN?: string;
  OAUTH_PROVIDER: OAuthHelpers;
}

const PRIVATE_HEADERS: Record<string, string> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
};

function text(body: string, status = 200, headers?: Headers): Response {
  const out = new Headers(headers);
  out.set("content-type", "text/plain; charset=utf-8");
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) out.set(name, value);
  return new Response(body, { status, headers: out });
}

function redirect(location: string, headers?: Headers): Response {
  const out = new Headers(headers);
  out.set("location", location);
  out.set("cache-control", "no-store");
  return new Response(null, { status: 302, headers: out });
}

/** The OAuth error answer to the client, once its redirect URI is known good. */
function redirectError(request: AuthRequest, description: string, headers?: Headers): Response {
  const url = new URL(request.redirectUri);
  url.searchParams.set("error", "access_denied");
  url.searchParams.set("error_description", description);
  url.searchParams.set("state", request.state);
  if (request.issuer) url.searchParams.set("iss", request.issuer);
  return redirect(url.href, headers);
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function origin(request: Request, env: GitHubEnv): string {
  return (env.PUBLIC_ORIGIN?.trim() || new URL(request.url).origin).replace(/\/+$/, "");
}

/** The name a client is shown by: its own client_name, or the host that publishes its metadata. */
function clientLabel(client: ClientInfo | null, clientId: string): string {
  const name = client?.clientName?.trim();
  if (name) return name.slice(0, 100);
  try {
    return new URL(clientId).hostname;
  } catch {
    return "an unnamed client";
  }
}

/**
 * The consent page, shown on every authorization. Consent has to be an act, so
 * it is a real form. Everything from the client is escaped: a CIMD document's
 * name is chosen by whoever serves it, a registered client's by its registrant.
 */
function consentPage(client: ClientInfo | null, request: AuthRequest, handle: string): string {
  const name = escape(clientLabel(client, request.clientId));
  const redirectHost = escape(new URL(request.redirectUri).hostname);
  // LEAST SCOPE FIRST (rule 12.3): the write box starts ticked only when the
  // client asked for foxing.write, and the administrator decides either way.
  const wantsWrite = request.scope.includes(SCOPE_WRITE);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Allow ${name} to use Foxing Admin?</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 system-ui, sans-serif; max-width: 34rem; margin: 4rem auto; padding: 0 1.25rem; }
  h1 { font-size: 1.35rem; line-height: 1.3; }
  label { display: inline-flex; gap: .5rem; align-items: center; min-height: 24px; }
  button { font: inherit; padding: .55rem 1.1rem; border-radius: .35rem; cursor: pointer; margin-right: .5rem; min-height: 24px; }
</style>
</head><body>
<h1>Allow ${name} to use Foxing Admin?</h1>
<p>Its access will be sent to <strong>${redirectHost}</strong>.</p>
<p>Foxing Admin runs foxing.app: the platform snapshot, readers, the catalog and
staff picks, Book of the Month, celebrity picks and the admin audit log. It cannot
write Journal posts; Carrel owns writing.</p>
<p>It will always be able to read. Changes need the box below.</p>
<p>Next you sign in with GitHub. Only the configured administrator account is accepted.</p>
<form method="post">
  <input type="hidden" name="handle" value="${escape(handle)}">
  <p><label><input type="checkbox" name="allow_write" value="1"${wantsWrite ? " checked" : ""}>
  Allow changes (foxing.write)</label></p>
  <button name="decision" value="approve">Continue to GitHub</button>
  <button name="decision" value="deny">Deny</button>
</form>
</body></html>`;
}

function configured(env: GitHubEnv): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

const NOT_CONFIGURED =
  "This server is not configured for sign-in: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is unset. " +
  "Not configured means not open.";

async function authorizeGet(request: Request, env: GitHubEnv): Promise<Response> {
  if (!configured(env)) return text(NOT_CONFIGURED, 503);
  const oauth = env.OAUTH_PROVIDER;
  const authRequest = await oauth.parseAuthRequest(request);
  const client = await oauth.lookupClient(authRequest.clientId);
  if (!client) return text("Unknown OAuth client.", 400);
  const consent = await oauth.beginConsent(authRequest);
  consent.headers.set("content-type", "text/html; charset=utf-8");
  // no-transform keeps Cloudflare from injecting anything into this page.
  consent.headers.set("cache-control", "no-store, no-transform");
  return new Response(consentPage(client, authRequest, consent.handle), {
    headers: consent.headers,
  });
}

async function authorizePost(request: Request, env: GitHubEnv): Promise<Response> {
  if (!configured(env)) return text(NOT_CONFIGURED, 503);
  const oauth = env.OAUTH_PROVIDER;
  const form = await request.formData();
  const handle = String(form.get("handle") ?? "");
  if (form.get("decision") !== "approve") {
    const denied = await oauth.denyConsent(request, handle);
    return redirect(denied.redirectTo, denied.headers);
  }
  // The grant is what the administrator ticked, never what the client asked.
  const scope = form.get("allow_write") === "1" ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];
  const approved = await oauth.approveConsent(request, handle, { scope });
  const { state, headers } = await oauth.beginUpstream(
    { ...approved.request, scope },
    { headers: approved.headers },
  );
  const github = new URL("https://github.com/login/oauth/authorize");
  github.searchParams.set("client_id", env.GITHUB_CLIENT_ID ?? "");
  github.searchParams.set("redirect_uri", `${origin(request, env)}/callback`);
  github.searchParams.set("scope", "");
  github.searchParams.set("state", state);
  return redirect(github.href, headers);
}

async function callback(request: Request, env: GitHubEnv): Promise<Response> {
  if (!configured(env)) return text(NOT_CONFIGURED, 503);
  const oauth = env.OAUTH_PROVIDER;
  const { request: original, headers } = await oauth.finishUpstream(request);
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return redirectError(original, "Sign-in with GitHub did not complete.", headers);

  const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${origin(request, env)}/callback`,
    }),
  });
  const token = (await tokenResp.json().catch(() => ({}))) as { access_token?: string };
  if (!token.access_token) {
    return redirectError(original, "GitHub declined the sign-in.", headers);
  }
  const userResp = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${token.access_token}`,
      accept: "application/vnd.github+json",
      "user-agent": "foxing-admin-mcp",
    },
  });
  if (!userResp.ok) return redirectError(original, "GitHub would not identify the account.", headers);
  const user = (await userResp.json()) as { id: number; login: string; name: string | null };

  if (!isAdminUser(env, user)) {
    console.warn(JSON.stringify({ door: "refused", reason: "not-the-administrator", login: user.login }));
    return redirectError(
      original,
      "This GitHub account is not the administrator of Foxing Admin.",
      headers,
    );
  }

  const granted = original.scope.includes(SCOPE_WRITE) ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];
  const props: Props = { id: user.id, login: user.login, name: user.name ?? null, scopes: granted };
  const { redirectTo } = await oauth.completeAuthorization({
    request: original,
    userId: String(user.id),
    metadata: { login: user.login },
    scope: granted,
    props,
  });
  return redirect(redirectTo, headers);
}

/** Everything the OAuth provider does not own: the consent flow and /health. */
export const defaultHandler = {
  async fetch(request: Request, env: GitHubEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/health") return text("ok");
      if (pathname === "/authorize" && request.method === "GET") return await authorizeGet(request, env);
      if (pathname === "/authorize" && request.method === "POST") {
        return await authorizePost(request, env);
      }
      if (pathname === "/callback" && request.method === "GET") return await callback(request, env);
      return text("Not found.", 404);
    } catch (error) {
      // Redirect only to a validated client; render the rest.
      if (error instanceof AuthorizationError && error.redirectUri) {
        const url = new URL(error.redirectUri);
        url.searchParams.set("error", error.code);
        url.searchParams.set("error_description", error.description);
        if (error.state) url.searchParams.set("state", error.state);
        if (error.issuer) url.searchParams.set("iss", error.issuer);
        return redirect(url.href);
      }
      if (error instanceof AuthorizationError) {
        return text(`${error.description} Start the sign-in again from your MCP client.`, 400);
      }
      if (error instanceof CimdFetchError) {
        return text(
          "This client could not be verified: its client metadata document could not be fetched.",
          400,
        );
      }
      throw error;
    }
  },
};
