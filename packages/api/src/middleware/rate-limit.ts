// Rate limiting on site-runtime's RateLimiter Durable Object (exact fixed windows), not the
// Workers ratelimit binding, which foxhound saw letting requests past the limit in production.
// write and companion key on the user id (60/min, 20/min, spec-cf-api), or the IP when signed
// out. Sign-in is limited by Better Auth itself (site-runtime ./sign-in, in the database).
// A missing or failing counter lets the request through, as the optional bindings did, so
// local and miniflare runs work without the binding; limit() logs each such pass.
import { limit, mustStop } from "@dustinedwards/site-runtime/rate-limit";
import { createMiddleware } from "hono/factory";
import { errors } from "../error";
import type { Env } from "../types";

type RlClass = "write" | "companion";

const PER_MINUTE: Record<RlClass, number> = { write: 60, companion: 20 };

export const rateLimit = (cls: RlClass) =>
  createMiddleware<Env>(async (c, next) => {
    const ip = c.req.raw.headers.get("cf-connecting-ip") ?? "anon";
    const who = c.get("session")?.id ?? ip;
    const rules = [{ limit: PER_MINUTE[cls], windowSeconds: 60 }];
    const verdict = await limit(c.env.RATE_LIMITER, `${cls}:${who}`, rules, {
      onUnavailable: "allow",
    });
    if (mustStop(verdict, "allow")) throw errors.rateLimited();
    await next();
  });
