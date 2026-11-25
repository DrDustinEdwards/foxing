/**
 * CLIENT LEG identity: who is operating, distinct from the API leg (what this Worker may do). Who the caller is is settled by
 * site-runtime's admin MCP door and never read from the request; ownership and scope are checked per call by authorizeCall (mcp-handler.ts).
 */

import { mcpScopes, type McpCaller } from "@dustinedwards/site-runtime/mcp-server";

/** Read is what every connection gets; write is ticked on the consent page, and only then do the tools that change foxing.app run. */
export const SCOPES = mcpScopes("foxing");

export type Caller = McpCaller;
