// Mounts Carrel's site API (@dustinedwards/site-api) on the Worker: the Journal adapter, the
// CARREL_SITE_KEY secret and the CARREL_RATE_LIMIT binding, with its preview links at
// /preview/<token>. The key reaches only /api/carrel/v1; a preview link carries no key, its token
// is the address, and it shows one post's current source until it expires or Carrel revokes it.
// Inside the prefix the package guards in order: prefix, rate limit, key, route. Outside it, a
// request that presents the key is refused before any other handler runs, so the key can never
// stand in for a session on an admin, user, club or /api/v1 route, now or after a later change
// to how sessions are read.

import { submitIndexNow } from "@drdustinedwards/site-helpers/indexnow";
import {
  createSiteApi,
  indexNowHook,
  insidePrefix,
  MIN_KEY_LENGTH,
  PREVIEW_LINK_PATH,
  type RateLimiter,
  type SiteApi,
  webmentionHook,
} from "@dustinedwards/site-api";
import { d1SiteApiStore } from "@dustinedwards/site-api/store";
import { safeEqual } from "@dustinedwards/site-runtime/compare";
import { schedulePurgeHook } from "@dustinedwards/site-runtime/edge-cache";
import { OWASP_EVENTS, logEvent, requestFields } from "@dustinedwards/site-runtime/log";
import type { Context, Hono, Next } from "hono";
import { RouterContextProvider } from "react-router";
import {
  cloudflareContext,
  cspNonceContext,
  type JournalPreview,
  journalPreviewContext,
} from "../../context";
import { INDEXNOW_KEY } from "../indexnow";
import { SITE_ORIGIN } from "../origins";
import { journalSiteAdapter } from "./journal-adapter.server";

type WorkerEnv = { Bindings: Env };

/** React Router's request handler (workers/app.ts), which a preview renders the journal route with. */
export type RenderDocument = (
  request: Request,
  context: RouterContextProvider,
) => Promise<Response>;

/**
 * The journal route's page for a post Carrel previews, rendered in-process at its own address with
 * the post handed to the route (journalPreviewContext). It carries no nonce, as a stored public page
 * carries none, so the page is the server's HTML and no script of it runs.
 */
function previewRenderer(env: Env, ctx: ExecutionContext, origin: string, render: RenderDocument) {
  return (slug: string, post: JournalPreview) => {
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    context.set(cspNonceContext, undefined);
    context.set(journalPreviewContext, post);
    return render(
      new Request(`${origin}/journal/${slug}`, { headers: { accept: "text/html" } }),
      context,
    );
  };
}

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

/**
 * One site API over the Journal, for a Carrel request, a preview link and the cron alike. The
 * store (packages/core/migrations/0011_site_api_store.sql) makes every write safe to send again
 * under its change id, keeps the preview links and the webmentions each post sent, and holds a
 * failed hook for the cron to retry. The hooks run after a write that changes a public page: a
 * published change tells IndexNow at once (a request from a preview origin sends nothing), and
 * the pages a post links to hear of it by webmention. The stored pages are purged by the gateway
 * after every Carrel write (workers/app.ts), and after a schedule the cron puts live by
 * schedulePurgeHook, since a schedule has no request behind it.
 */
function carrelSiteApi(
  env: Env,
  options: {
    sourceIp: string | null;
    renderPreview?: Parameters<typeof journalSiteAdapter>[0]["renderPreview"];
  },
): SiteApi {
  const store = d1SiteApiStore(env.DB);
  return createSiteApi({
    adapter: journalSiteAdapter({ env, ...options }),
    key: env.CARREL_SITE_KEY,
    limiter: carrelLimiter(env),
    store,
    hooks: [
      indexNowHook({ submit: submitIndexNow, origin: SITE_ORIGIN, key: INDEXNOW_KEY }),
      webmentionHook({ store }),
      schedulePurgeHook(),
    ],
  });
}

/**
 * The per-minute cron's job (workers/app.ts): every scheduled post and update whose time has come
 * goes live, with the hooks a Carrel publish runs; the hooks that failed earlier run again; the
 * posts 30 days in the trash are deleted; and the replay store is pruned. A schedule that fails
 * fails the job, and is tried next minute.
 */
export async function runCarrelSchedules(env: Env, now: Date): Promise<void> {
  const run = await carrelSiteApi(env, { sourceIp: null }).runSchedules({ now });
  if (run.failed > 0) throw new Error(`${run.failed} Carrel schedule(s) failed`);
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
 * Registers the off-prefix refusal, the /api/carrel/v1 handler and the preview links. Call it
 * before any other route or middleware on the Worker's root app, so the refusal runs first.
 * `render` is React Router's handler, which a preview draws the journal route with.
 */
export function mountCarrel(app: Hono<WorkerEnv>, render: RenderDocument): void {
  app.use("*", async (c: Context<WorkerEnv>, next: Next) => {
    if (await presentsCarrelKeyOffPrefix(c.req.raw, c.env)) {
      logEvent(
        OWASP_EVENTS.authorizationFailure,
        {
          ...requestFields(c.req.raw),
          reason: "carrel-key-off-prefix",
        },
        { level: "warn" },
      );
      return c.json(
        { error: "unauthorized", message: "The Carrel key is accepted only under /api/carrel/v1." },
        401,
      );
    }
    await next();
  });

  const handler = async (c: Context<WorkerEnv>) => {
    const ctx = c.executionCtx as unknown as ExecutionContext;
    const api = carrelSiteApi(c.env, {
      sourceIp: c.req.header("cf-connecting-ip") ?? null,
      renderPreview: previewRenderer(c.env, ctx, new URL(c.req.url).origin, render),
    });
    // A preview link: noindex, private, no-store and no-referrer from the package (the security
    // headers' Referrer-Policy is no-referrer too), so the token, which is the address, is never
    // sent on.
    if (api.matchesPreviewLink(c.req.raw)) return api.servePreviewLink(c.req.raw);
    return api.handle(c.req.raw, ctx);
  };
  app.all("/api/carrel/v1", handler);
  app.all("/api/carrel/v1/*", handler);
  app.get(`${PREVIEW_LINK_PATH}*`, handler);
}
