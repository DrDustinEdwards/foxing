// Single Worker entry. Hono is the root fetch handler and delegates:
//   /api/carrel/v1/* -> Carrel's site API over the Journal (app/lib/carrel)
//   /api/auth/*  -> Better Auth
//   /api/v1/*    -> mounted @foxing/api (thin routes -> core -> D1)
//   everything   -> React Router SSR
// Order matters: API routes register before the React Router catch-all.
import { AppError, createApi, rateLimit } from "@foxing/api";
import { billing, catalogRepo, companion, createDb, push } from "@foxing/core";
import { Hono } from "hono";
import { RouterContextProvider, createRequestHandler } from "react-router";
import { cloudflareContext, cspNonceContext } from "../app/context";
import { edgeCache } from "../app/lib/cache.server";
import { getAuth, sessionUserFromRequest } from "../app/lib/auth.server";
import { mountCarrel } from "../app/lib/carrel/site-api.server";
import { legacyRedirectTarget } from "../app/lib/redirects";
import { ClubRoom } from "./club-room";
import { runBackup } from "../app/lib/backup.server";
import {
  CSP_REPORT_PATH,
  cspNonceFor,
  handleCspReport,
  withSecurityHeaders,
} from "./security-headers";

// Public catalog surfaces are anonymous and safe to cache at the edge. Segment
// prefixes match the path or any child (/books, /books/x), not lookalikes (/booksy).
const PUBLIC_EXACT = new Set([
  "/",
  "/sitemap.xml",
  "/robots.txt",
  "/privacy",
  "/terms",
  "/about",
  "/features",
  "/guide",
  "/app-guide",
]);
const PUBLIC_PREFIXES = [
  "/books",
  "/authors",
  "/awards",
  "/picks",
  "/book-of-the-month",
  "/journal",
  "/search",
  "/og",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Injected at build time (vite define). Namespaces the edge cache per deploy.
declare const __CACHE_VERSION__: string;

/** Cache key = the request URL plus the build id, so a new deploy starts fresh. */
function cacheKeyFor(url: URL): Request {
  const keyUrl = new URL(url.toString());
  keyUrl.searchParams.set("__v", __CACHE_VERSION__);
  return new Request(keyUrl.toString(), { method: "GET" });
}

const reactRouterHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const api = createApi({
  resolveSession: (req, env) => sessionUserFromRequest(req, env as unknown as Env),
  // ANTHROPIC_API_KEY is not set as a Worker secret yet (Phase 4a precheck). Every
  // other route works normally; only an actual companion call fails, cleanly, until
  // `wrangler secret put ANTHROPIC_API_KEY` runs.
  resolveCompanionCaller: (env) => {
    const apiKey = (env as unknown as Env).ANTHROPIC_API_KEY;
    if (apiKey) return companion.createAnthropicCaller(apiKey);
    // biome-ignore lint/correctness/useYield: throws on first iteration by design, never yields
    return async function* missingKey() {
      throw new Error(
        "ANTHROPIC_API_KEY is not configured. Run: wrangler secret put ANTHROPIC_API_KEY",
      );
    };
  },
  // Stripe secrets + price ids are not set yet (Phase 4b gate). When all four are
  // present the real client is used; otherwise the not-configured stub makes billing
  // routes answer 503 cleanly, and everything else works.
  resolveBilling: (env) => {
    const e = env as unknown as Env;
    if (
      e.STRIPE_SECRET_KEY &&
      e.STRIPE_WEBHOOK_SECRET &&
      e.STRIPE_PRICE_MONTHLY &&
      e.STRIPE_PRICE_ANNUAL
    ) {
      return {
        client: billing.createStripeBilling({
          secretKey: e.STRIPE_SECRET_KEY,
          webhookSecret: e.STRIPE_WEBHOOK_SECRET,
        }),
        prices: { monthly: e.STRIPE_PRICE_MONTHLY, annual: e.STRIPE_PRICE_ANNUAL },
      };
    }
    return { client: billing.notConfiguredBilling(), prices: { monthly: "", annual: "" } };
  },
  // The live layer (Phase 5). One ClubRoom Durable Object per club; the API calls
  // broadcast() only AFTER a write commits to D1 (write -> commit -> notify), and
  // connect() forwards a membership-checked upgrade to that club's object. The DO
  // never writes D1.
  resolveHub: (env) => {
    const ns = (env as unknown as Env).CLUB_ROOM;
    return {
      async broadcast(clubId, message) {
        await ns.getByName(clubId).broadcast(message);
      },
      async connect(clubId, userId, request) {
        // Pass the verified user id on the URL; new Request(url, request) preserves the
        // WebSocket upgrade so the ClubRoom can accept it.
        const url = new URL(request.url);
        url.searchParams.set("uid", userId);
        return ns.getByName(clubId).fetch(new Request(url, request));
      },
    };
  },
});

const app = new Hono<{ Bindings: Env }>();

// The Content-Security-Policy report sink the policy names.
app.post(CSP_REPORT_PATH, (c) => handleCspReport(c.req.raw));

// Carrel's site API at /api/carrel/v1, mounted first: its off-prefix refusal must run before
// every other route, so the Carrel key is refused on auth, /api/v1 and page routes alike.
mountCarrel(app, reactRouterHandler);

// The wired AUTH_RL class (5/min/IP). Applied to credential submissions below.
const authLimiter = rateLimit("auth");

// The password reset link is a GET navigation Better Auth handles directly. If the
// token lookup fails unexpectedly (a D1 blip that outlives the retry, say), Better
// Auth would answer with a raw 500 or its own "Something went wrong" page. For that
// one navigation we intercept and send the user to the friendly /reset-password
// screen, which offers a retry link. Every other auth route is untouched.
function isResetCallback(req: Request): boolean {
  if (req.method !== "GET") return false;
  return new URL(req.url).pathname.startsWith("/api/auth/reset-password/");
}

function friendlyResetRedirect(req: Request): Response {
  const to = new URL("/reset-password", req.url);
  to.searchParams.set("error", "unavailable");
  return Response.redirect(to.toString(), 302);
}

app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const req = c.req.raw;
  // Credential-stuffing defense: throttle credential submissions (POST: sign-in,
  // sign-up, password-reset requests) with the wired AUTH_RL class (5/min/IP). GET
  // navigations (session checks, the reset callback) are not throttled. The class
  // throws AppError on limit; the root app has no onError, so convert it here.
  if (req.method === "POST") {
    try {
      await authLimiter(c as never, async () => {});
    } catch (err) {
      if (err instanceof AppError) {
        return c.json({ error: { code: err.code, message: err.message } }, 429);
      }
      throw err;
    }
  }
  try {
    const res = await getAuth(c.env).handler(req);
    if (isResetCallback(req)) {
      const location = res.headers.get("Location") ?? "";
      if (res.status >= 500 || location.includes("/api/auth/error")) {
        return friendlyResetRedirect(req);
      }
    }
    return res;
  } catch (err) {
    if (isResetCallback(req)) return friendlyResetRedirect(req);
    throw err;
  }
});

app.route("/api/v1", api);

// Exploded Readium reader assets (RWPM manifest + resources + position list),
// served same-origin from the MEDIA R2 bucket under reader/<slug>/... Same-origin
// means the ts-toolkit HttpFetcher needs no CORS. X-Robots-Tag: noindex keeps the
// duplicate book text out of search indexes (the canonical page is /books/:slug).
// Immutable long cache + edge Cache API: first hit streams from R2, the rest are
// CDN hits with no Worker R2 read.
const READER_ASSET_CONTENT_TYPES: Record<string, string> = {
  xhtml: "application/xhtml+xml",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  xml: "application/xml",
  ncx: "application/x-dtbncx+xml",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
  otf: "font/otf",
  ttf: "font/ttf",
  woff: "font/woff",
  woff2: "font/woff2",
};

app.get("/reader-assets/*", async (c) => {
  const url = new URL(c.req.url);
  const rest = decodeURIComponent(url.pathname.replace(/^\/reader-assets\//, ""));
  // Guard against traversal; keys are always reader/<slug>/<path>.
  if (!rest || rest.includes("..")) return c.notFound();
  const key = `reader/${rest}`;

  const cache = edgeCache();
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.notFound();

  const ext = rest.split(".").pop()?.toLowerCase() ?? "";
  const stored =
    obj.httpMetadata?.contentType ?? READER_ASSET_CONTENT_TYPES[ext] ?? "application/octet-stream";
  // A book's own scripts never run. Readium's frames are same-origin, so the reader's CSP ('self')
  // would let an EPUB's external <script src> load from here; served as text/plain, nosniff makes
  // the browser refuse to run it. (Its inline scripts are refused by the CSP, which they carry no
  // nonce for.)
  const contentType = /javascript|ecmascript/i.test(stored) ? "text/plain; charset=utf-8" : stored;

  const res = new Response(obj.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Robots-Tag": "noindex",
      ETag: obj.httpEtag,
    },
  });
  c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
});

app.all("*", async (c) => {
  const req = c.req.raw;
  const url = new URL(req.url);
  // Legacy path 301s (GET navigations only). Preserve the query string; one hop.
  if (req.method === "GET") {
    const target = legacyRedirectTarget(url.pathname);
    if (target) {
      const dest = new URL(target, url.origin);
      dest.search = url.search;
      return c.redirect(dest.toString(), 301);
    }
  }
  // Cache anonymous GETs on public paths. A Better Auth session cookie means the
  // request may be personalized later, so bypass the cache to stay correct.
  const authed = (req.headers.get("Cookie") ?? "").includes("better-auth");
  const cacheable = req.method === "GET" && isPublicPath(url.pathname) && !authed;
  const cache = edgeCache();
  const key = cacheKeyFor(url);

  if (cacheable) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }

  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    env: c.env,
    ctx: c.executionCtx as unknown as ExecutionContext,
  });
  context.set(cspNonceContext, cspNonceFor(req));
  // Headers applied before the cache put, so a cached page keeps the nonce it was rendered with
  // and withSecurityHeaders can re-issue it on every hit.
  const res = withSecurityHeaders(await reactRouterHandler(req, context), req);

  // Only cache successful responses that opted in with an s-maxage directive.
  if (
    cacheable &&
    res.status === 200 &&
    (res.headers.get("Cache-Control") ?? "").includes("s-maxage")
  ) {
    c.executionCtx.waitUntil(cache.put(key, res.clone()));
  }
  return res;
});

// Phase 4a companion cache pipeline. Cron finds catalog books missing a cached action
// and enqueues one message per book; the queue consumer generates the 4 free-cached
// actions for that book and writes book_ai_cache. Both reuse the same core functions
// the manual proof script and the admin ops route call (one generation code path).
type CacheJobMessage = { bookId: string };

// Phase 7 push delivery sweep. Runs on a frequent cron: it push-delivers notifications
// created since the last sweep (deduped in KV), gated per user by category prefs + quiet
// hours (domain/push). Kept off the notification write path so core stays binding-free;
// the cadence trades a little latency for that decoupling. In-app notifications are
// unaffected. Requires the frequent cron in wrangler.jsonc triggers.
const PUSH_SWEEP_CRON = "*/5 * * * *";
const PUSH_SWEEP_LOOKBACK_MS = 10 * 60 * 1000;

// Nightly D1 backup into R2 (app/lib/backup.server.ts). Must match wrangler.jsonc triggers.
const BACKUP_CRON = "17 3 * * *";

async function runPushSweep(env: Env): Promise<void> {
  const db = createDb(env.DB);
  const kv = env.APP_KV;
  const now = Date.now();
  const lastRaw = await kv.get("push:last_sweep");
  const since = lastRaw ? Number(lastRaw) : now - PUSH_SWEEP_LOOKBACK_MS;
  try {
    await push.sweepPushDeliveries(db, { fetchImpl: fetch, nowUtcMs: now, kv }, since);
  } finally {
    await kv.put("push:last_sweep", String(now));
  }
}

async function scheduled(
  event: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  // Nightly cron: dump D1 to the BACKUPS bucket. Awaited, not handed to waitUntil, so a
  // failed dump fails this invocation (Cron Events shows it) after the log line below, and
  // /health's backup age grows toward its 26 hour warning. Never swallowed.
  if (event.cron === BACKUP_CRON) {
    try {
      await runBackup(env);
    } catch (err) {
      console.error(JSON.stringify({ event: "backup_failed", error: String(err) }));
      throw err;
    }
    return;
  }

  // Frequent cron: deliver queued push notifications.
  if (event.cron === PUSH_SWEEP_CRON) {
    ctx.waitUntil(runPushSweep(env));
    return;
  }

  // Daily cron: enqueue catalog books needing cached AI generation.
  const db = createDb(env.DB);
  const limit = Number(env.COMPANION_CACHE_BATCH_SIZE) || 20;
  const books = await catalogRepo.findBooksNeedingCache(db, companion.CACHED_ACTION_NAMES, limit);
  for (const book of books) {
    ctx.waitUntil(env.COMPANION_CACHE_QUEUE.send({ bookId: book.id } satisfies CacheJobMessage));
  }
}

async function queue(
  batch: MessageBatch<CacheJobMessage>,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const db = createDb(env.DB);
  const caller = env.ANTHROPIC_API_KEY
    ? companion.createAnthropicCaller(env.ANTHROPIC_API_KEY)
    : null;

  for (const message of batch.messages) {
    if (!caller) {
      // No key yet: retry later rather than dropping the job or generating nothing.
      message.retry();
      continue;
    }
    try {
      const book = await catalogRepo.getBookById(db, message.body.bookId);
      if (!book) {
        message.ack(); // the book no longer exists; nothing to retry
        continue;
      }
      await companion.generateCachedActionsForBook(db, caller, {
        id: book.id,
        title: book.title,
        author: book.author,
        description: book.description,
        publicationYear: book.publicationYear,
        subjects: book.subjects,
      });
      message.ack();
    } catch (err) {
      console.error(`[companion-cache] failed for book ${message.body.bookId}`, err);
      message.retry();
    }
  }
}

// The ClubRoom Durable Object class must be a named export of the Worker's entry module
// so the runtime can instantiate it for the CLUB_ROOM binding.
export { ClubRoom } from "./club-room";

// Security headers on every response this Worker sends: pages, API, redirects, errors, 404s and
// edge-cache hits (workers/security-headers.ts). Applied outside Hono, on what app.fetch returns:
// Hono's own error and not-found answers included, and no middleware can copy an older header back.
async function handleFetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  return withSecurityHeaders(await app.fetch(request, env, ctx), request);
}

export default { fetch: handleFetch, scheduled, queue };
