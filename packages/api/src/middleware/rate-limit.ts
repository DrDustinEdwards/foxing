// Rate limiting on site-runtime's RateLimiter Durable Object (exact fixed windows, site-runtime ./hono
// honoRateLimit), not the Workers ratelimit binding, which foxhound saw letting requests past the limit in
// production. write and companion key on the user id (60/min, 20/min, spec-cf-api), or the edge address when signed
// out. Sign-in is limited by Better Auth itself (site-runtime ./sign-in, in the database). A missing or failing
// counter lets the request through, so local and miniflare runs work without the binding; limit() logs each such pass.
import { honoRateLimit } from "@dustinedwards/site-runtime/hono";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { Env } from "../types";

type RlClass = "write" | "companion";

const PER_MINUTE: Record<RlClass, number> = { write: 60, companion: 20 };

export const rateLimit = (cls: RlClass) => {
  const counted = honoRateLimit<Context<Env>>({
    limiter: (c) => c.env.RATE_LIMITER,
    bucket: cls,
    rules: [{ limit: PER_MINUTE[cls], windowSeconds: 60 }],
    who: (c) => c.get("session")?.id,
    onUnavailable: "allow",
  });
  return createMiddleware<Env>(async (c, next) => {
    await counted(c, next);
  });
};
