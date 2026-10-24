// The one place the Worker builds the companion's Anthropic caller: the key from
// ANTHROPIC_API_KEY, and the route from site-runtime's anthropicRoute, so every call
// (companion chat, Find next book, the catalog cache queue) goes through AI Gateway once
// AI_GATEWAY_BASE_URL is set, and straight to Anthropic until then. Null with no key.
import { anthropicRoute } from "@dustinedwards/site-runtime/ai-gateway";
import { companion } from "@foxing/core";

export function anthropicCaller(env: Env): companion.CompanionCaller | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  return companion.createAnthropicCaller(env.ANTHROPIC_API_KEY, anthropicRoute(env, "foxing"));
}
