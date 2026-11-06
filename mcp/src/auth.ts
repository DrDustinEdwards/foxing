/**
 * CLIENT LEG identity: who is operating.
 *
 * Distinct from the API leg in src/api-client.ts, which is what this Worker may do. A client-leg failure (this grant is
 * not the administrator's) and an API refusal (the admin API said no) mean different things and read differently.
 *
 * Who the caller is, is settled by site-runtime's admin MCP door (index.ts) and never read from the request. The per-call
 * ownership and scope check (rule 12.1, 12.3) is site-runtime's authorizeCall, run by its invokeTool for every tool call
 * (mcp-handler.ts).
 */

import { mcpScopes, type McpCaller } from "@dustinedwards/site-runtime/mcp-server";

/**
 * LEAST SCOPE FIRST. Ruling mcp-2026-10-10, rule 12.3.
 *
 * Read is what every connection gets. Write is ticked on the consent page, and only then do the tools that change
 * foxing.app run.
 */
export const SCOPES = mcpScopes("foxing");

/** Who is making one tool call: the administrator, or the list-only test key (listed the read tools, refused every call). */
export type Caller = McpCaller;
