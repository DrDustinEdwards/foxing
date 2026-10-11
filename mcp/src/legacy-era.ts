/**
 * THE PRIOR-ERA SHIM. One module, one call site, deletable as a unit.
 *
 * REMOVAL CONDITION: delete this file and its single call site in
 * src/mcp-handler.ts when the target clients (Claude Code, claude.ai) are
 * measured opening with `server/discover` instead of `initialize`. Measure it
 * against a real client; a release note is not a measurement.
 *
 * Last measured by Dustin Edwards Admin, the sibling server on the same stack:
 * Claude Code 2.1.203 (2026-07-29) and claude.ai (2026-07-30) both open at
 * 2025-11-25 with `initialize`. A modern-only server would be unreachable from
 * them, so the shim is load-bearing today.
 *
 * The real handler is built `legacy: "reject"` (stateless-native 2026-07-28).
 * Legacy traffic is routed here in user land, as the library documents on
 * `isLegacyRequest`, so deleting this file leaves a modern-only server.
 */

import { isLegacyRequest } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";

import type { StatelessMcpHandler } from "agents/mcp/server";

export { isLegacyRequest };

/** The prior-era handler: each legacy request is answered by a fresh server from the same factory. */
export function createLegacyEraHandler(
  factory: Parameters<typeof createMcpHandler>[0],
  route: string,
): StatelessMcpHandler {
  return createMcpHandler(factory, { route, legacy: "stateless" });
}
