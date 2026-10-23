/**
 * CLIENT LEG identity: who is operating.
 *
 * Distinct from the API leg in src/api-client.ts, which is what this Worker may
 * do. A client-leg failure (this grant is not the administrator's) and an API
 * refusal (the admin API said no) mean different things and read differently.
 *
 * Free of MCP and OAuth imports so the grant logic is testable on its own.
 */

import { isAdminUser } from "@dustinedwards/site-runtime/mcp-login";

/** The Cloudflare Access identity carried on an OAuth grant, set at sign-in. */
export interface Props extends Record<string, unknown> {
  /** The verified email from the Access ID token. */
  email: string;
  /** The scopes the administrator granted on the consent page. */
  scopes?: string[];
}

/**
 * LEAST SCOPE FIRST. Ruling mcp-2026-10-10, rule 12.3.
 *
 * Read is what every connection gets. Write is ticked on the consent page, and
 * only then do the tools that change foxing.app run.
 */
export const SCOPE_READ = "foxing.read";
export const SCOPE_WRITE = "foxing.write";
export const SCOPES = [SCOPE_READ, SCOPE_WRITE] as const;
export type Scope = (typeof SCOPES)[number];

/** Who is making one tool call, as the request boundary established it. Never read from the request. */
export type Caller = { kind: "admin"; props: Props; scopes: readonly string[] };

/** The audit name of a caller: the signed-in email, never a credential. */
export function callerName(caller: Caller): string {
  return `access:${caller.props.email}`;
}

/**
 * THE PER-CALL OWNERSHIP CHECK. Ruling mcp-2026-10-10, rule 12.1.
 *
 * Every id a tool takes (a user, a book, a Book of the Month entry, a pick)
 * names a foxing.app record that only a Foxing admin may act on. So proving the
 * caller owns the id is proving the caller IS the configured administrator, on
 * every call rather than once at the door: a grant is long lived. The admin API
 * then re-checks the acting Foxing account's is_admin from D1, so a revoked
 * admin is refused there too.
 *
 * Returns null when the call may proceed, or the refusal to show the caller.
 */
export function authorizeCall(
  env: { ADMIN_EMAIL?: string },
  caller: Caller | undefined,
  scope: Scope,
): string | null {
  if (!caller) {
    return "Refused: no caller identity reached this tool call. Connect again through the OAuth flow.";
  }
  if (!isAdminUser(env, caller.props)) {
    return (
      "Refused: this grant does not belong to the administrator of foxing.app, " +
      "so it owns none of the records this tool names."
    );
  }
  if (!caller.scopes.includes(scope)) {
    return scope === SCOPE_WRITE
      ? "Refused: this connection holds read access only (foxing.read), and this tool changes foxing.app. " +
          'Reconnect and tick "Allow changes" on the consent page.'
      : "Refused: this connection holds no read scope. Reconnect through the OAuth flow.";
  }
  return null;
}
