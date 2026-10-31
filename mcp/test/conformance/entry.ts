// Test-only entry for `npm run check:conformance`. NEVER DEPLOYED: the deploy target is src/index.ts, and this file is
// reached only by passing it positionally to `wrangler dev`.
//
// The official conformance suite cannot complete an OAuth sign-in through Access, so this mounts the REAL protocol
// layer and the REAL tools (src/mcp-handler.ts) with the door's token check replaced by a fixed read-only caller. There
// is no FOXING binding, so a tool call answers "not configured" and never reaches foxing.app. What gets certified is the
// code that ships. The door (src/index.ts) is certified separately, as the config's main.

import { handleMcp } from "../../src/mcp-handler";

export { ToolCallLog } from "@dustinedwards/site-runtime/audit-log";
export { RateLimiter as McpRateLimit } from "@dustinedwards/site-runtime/rate-limit/durable-object";

const CALLER = { kind: "admin" as const, props: { email: "admin@conformance.invalid" }, scopes: ["foxing.read"] };

export default {
  fetch(request, env, ctx) {
    return handleMcp(request, env, ctx, CALLER);
  },
} satisfies ExportedHandler<Env>;
