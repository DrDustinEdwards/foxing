// Mounts Carrel's site API (@dustinedwards/site-api) on the Worker: the Journal adapter, the
// CARREL_SITE_KEY secret and the CARREL_RATE_LIMIT binding. The key reaches only /api/carrel/v1.
// Inside the prefix the package guards in order: prefix, rate limit, key, route. Outside it, a
// request that presents the key is refused before any other handler runs, so the key can never
// stand in for a session on an admin, user, club or /api/v1 route, now or after a later change
// to how sessions are read.

import {
  createSiteApi,
  insidePrefix,
  MIN_KEY_LENGTH,
  type RateLimiter,
} from "@dustinedwards/site-api";
import { safeEqual } from "@dustinedwards/site-runtime/compare";
import type { Context, Hono, Next } from "hono";
import { journalSiteAdapter, type RenderDocument } from "./journal-adapter.server";

type WorkerEnv = { Bindings: Env };

/**
 * The Workers `ratelimit` binding, per caller address (wrangler.jsonc). A missing binding throws,
 * which the package answers 503: the API fails closed rather than running unlimited.
 */
function carrelLimiter(env: Env): RateLimiter {
  return {
    async limit({ key }) {
      const binding = env.CARREL_RATE_LIMIT as RateLimit | undefined;
      if (!binding) throw new Error("CARREL_RATE_LIMIT is not bound");
      return binding.limit({ key });
    },
  };
}

/** One Carrel request, answered by the package over the Journal adapter. */
function handleCarrelRequest(
  request: Request,
  options: { env: Env; ctx: ExecutionContext; renderDocument: RenderDocument | null },
): Promise<Response> {
  const { env, ctx, renderDocument } = options;
  const api = createSiteApi({
    adapter: journalSiteAdapter({
      env,
      ctx,
      origin: new URL(request.url).origin,
      sourceIp: request.headers.get("cf-connecting-ip"),
      renderDocument,
    }),
    key: env.CARREL_SITE_KEY,
    limiter: carrelLimiter(env),
  });
  return api.handle(request);
}

/**
 * True when a request outside the prefix presents the Carrel key as its bearer token. Compared by
 * site-runtime's constant-time digest check; an unset or short key matches nothing.
 */
async function presentsCarrelKeyOffPrefix(request: Request, env: Env): Promise<boolean> {
  if (insidePrefix(new URL(request.url).pathname)) return false;
  const header = request.headers.get("authorization");
  const presented = header ? /^Bearer[ ]+(\S+)\s*$/i.exec(header)?.[1] : undefined;
  if (!presented) return false;
  const key = env.CARREL_SITE_KEY?.trim() ?? "";
  if (key.length < MIN_KEY_LENGTH) return false;
  return safeEqual(presented, key);
}

/**
 * Registers the off-prefix refusal and the /api/carrel/v1 handler. Call it before any other route
 * or middleware on the Worker's root app, so the refusal runs first.
 */
export function mountCarrel(app: Hono<WorkerEnv>, renderDocument: RenderDocument | null): void {
  app.use("*", async (c: Context<WorkerEnv>, next: Next) => {
    if (await presentsCarrelKeyOffPrefix(c.req.raw, c.env)) {
      console.warn(JSON.stringify({ siteApi: "refused", reason: "key-off-prefix" }));
      return c.json(
        { error: "unauthorized", message: "The Carrel key is accepted only under /api/carrel/v1." },
        401,
      );
    }
    await next();
  });

  const handler = (c: Context<WorkerEnv>) =>
    handleCarrelRequest(c.req.raw, {
      env: c.env,
      ctx: c.executionCtx as unknown as ExecutionContext,
      renderDocument,
    });
  app.all("/api/carrel/v1", handler);
  app.all("/api/carrel/v1/*", handler);
}
