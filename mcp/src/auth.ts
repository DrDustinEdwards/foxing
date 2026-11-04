/**
 * CLIENT LEG identity: who is operating.
 *
 * Distinct from the API leg in src/api-client.ts, which is what this Worker may
 * do. A client-leg failure (this grant is not the administrator's) and an API
 * refusal (the admin API said no) mean different things and read differently.
 *
 * The per-call ownership and scope check (rule 12.1, 12.3) is site-runtime's
 * authorizeCall, run by its invokeTool for every tool call (mcp-handler.ts).
 */

import { mcpScopes } from "@dustinedwards/site-runtime/mcp-server";

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
export const SCOPES = mcpScopes("foxing");
export const SCOPE_READ = SCOPES.read;
export const SCOPE_WRITE = SCOPES.write;

/**
 * Who is making one tool call, as the request boundary established it. Never read from the request. The `probe` is the
 * list-only test key (index.ts): listed the read tools, refused every call.
 */
export type Caller =
  | { kind: "admin"; props: Props; scopes: readonly string[] }
  | { kind: "probe"; principal: string; scopes: readonly string[] };

