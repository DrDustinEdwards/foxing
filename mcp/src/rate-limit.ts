/**
 * Rate limiting on the MCP endpoint and on /register, with the family's one limiter
 * (@dustinedwards/site-runtime/rate-limit). index.ts exports its Durable Object as McpRateLimit.
 */
import { limit } from "@dustinedwards/site-runtime/rate-limit";
import type { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

/** Requests allowed per minute, per identity. */
const PER_MINUTE = 30;

export interface RateLimitEnv {
  MCP_RATE_LIMIT: DurableObjectNamespace<RateLimiter>;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number;
}

/** Checks the limit for one identity. Fails CLOSED when the binding is absent or failing. */
export async function checkRateLimit(
  env: Partial<RateLimitEnv>,
  identity: string,
  perMinute = PER_MINUTE,
): Promise<RateLimitDecision> {
  const verdict = await limit(env.MCP_RATE_LIMIT, identity, [{ limit: perMinute, windowSeconds: 60 }], {
    onUnavailable: "refuse",
  });
  return { allowed: verdict.status === "ok", retryAfter: verdict.retryAfterSeconds };
}
