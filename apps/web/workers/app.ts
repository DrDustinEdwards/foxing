// Single Worker entry. Hono is the root fetch handler and delegates:
//   /api/carrel/v1/* -> Carrel's site API over the Journal (app/lib/carrel)
//   /api/auth/*  -> Better Auth
//   /api/v1/*    -> mounted @foxing/api (thin routes -> core -> D1)
//   everything   -> React Router SSR
// Order matters: API routes register before the React Router catch-all.
// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { WorkerEntrypoint } from "cloudflare:workers";
import { accessAdmin } from "@dustinedwards/site-runtime/access";
import {
  EDGE_CACHE_HEADER,
  PAGES_CACHE_TAG,
  SHARED_CACHE_CONTROL,
  UNCACHED,
  cacheKey,
  forReader,
  purgeTags,
  settleCacheHeaders,
} from "@dustinedwards/site-runtime/edge-cache";
import { refuseCrossSite } from "@dustinedwards/site-runtime/origin";
import { preloads } from "@dustinedwards/site-runtime/preload";
import { slashRedirect } from "@dustinedwards/site-runtime/url";
import { createApi } from "@foxing/api";
import { billing, catalogRepo, companion, createDb, push } from "@foxing/core";
import { Hono } from "hono";
import { RouterContextProvider, type ServerBuild, createRequestHandler } from "react-router";
import { cloudflareContext, cspNonceContext } from "../app/context";
import { anthropicCaller } from "../app/lib/anthropic.server";
import { edgeCache } from "../app/lib/cache.server";
import { getAuth, sessionUserFromRequest } from "../app/lib/auth.server";
import { mountCarrel } from "../app/lib/carrel/site-api.server";
import { legacyRedirectTarget } from "../app/lib/redirects";
import { runBackup } from "../app/lib/backup.server";
import {
  CSP_REPORT_PATH,
  cspNonceFor,
  handleCspReport,
  withSecurityHeaders,
} from "./security-headers";

// The public catalog surfaces: an anonymous GET of one goes to the Renderer, whose responses the
// Workers cache stores when the route marks them shared (publicPageHeaders). Segment prefixes match
// the path or any child (/books, /books/x), not lookalikes (/booksy).
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

// Injected at build time (vite define). Namespaces the search suggestions' cache per deploy.
declare const __CACHE_VERSION__: string;

/** The search suggestions' cache key: the request URL plus the build id, so a new deploy starts fresh. */
function suggestKeyFor(url: URL): Request {
  const keyUrl = new URL(url.toString());
  keyUrl.searchParams.set("__v", __CACHE_VERSION__);
  return new Request(keyUrl.toString(), { method: "GET" });
}

const serverBuild = () => import("virtual:react-router/server-build") as Promise<ServerBuild>;
const reactRouterHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

const api = createApi({
  resolveSession: (req, env) => sessionUserFromRequest(req, env as unknown as Env),
  // Cloudflare Access must have signed the request for this admin's own email (site-runtime ./access).
  checkAdminAccess: async (req, env, email) =>
    (await accessAdmin(req, env as unknown as Env, { admins: [email] })) !== null,
  // ANTHROPIC_API_KEY is not set as a Worker secret yet (Phase 4a precheck). Every
  // other route works normally; only an actual companion call fails, cleanly, until
  // `wrangler secret put ANTHROPIC_API_KEY` runs.
  resolveCompanionCaller: (env) => {
    const caller = anthropicCaller(env as unknown as Env);
    if (caller) return caller;
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
  // The live layer. One ClubRoom Durable Object per club; the API calls
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

// The writes that can change a stored page: Carrel's (the Journal and its pictures) and the admin
// API's (catalog, picks, awards, book of the month), the admin MCP's included. Each accepted one
// purges every stored page; a failed purge is a log line and a page stale until it expires. A purge
// reaches only the cache of the entrypoint that calls it, so the Renderer runs it, over RPC.
const PAGE_WRITERS = ["/api/carrel/v1", "/api/v1/admin"];
app.use("*", async (c, next) => {
  await next();
  const { method } = c.req;
  if (method === "GET" || method === "HEAD" || !c.res.ok) return;
  const { pathname } = new URL(c.req.url);
  if (!PAGE_WRITERS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
  const renderer = (c.executionCtx.exports as Partial<Cloudflare.Exports> | undefined)?.Renderer;
  if (renderer) c.executionCtx.waitUntil(renderer.purgePages(`${method} ${pathname}`));
});

// The Content-Security-Policy report sink the policy names.
app.post(CSP_REPORT_PATH, (c) => handleCspReport(c.req.raw, c.env));

// Carrel's site API at /api/carrel/v1, mounted first: its off-prefix refusal must run before
// every other route, so the Carrel key is refused on auth, /api/v1 and page routes alike.
mountCarrel(app, reactRouterHandler);

// Better Auth: sign-in, sessions, passkeys. Its own limiter holds sign-in to a few tries a
// minute per address, counted in D1 (site-runtime ./sign-in).
app.on(["GET", "POST"], "/api/auth/*", async (c) => (await getAuth(c.env)).handler(c.req.raw));

// Every write is an /api/v1 route (the admin API included), none reached through React Router's
// own Origin check, so a browser write from another origin is refused here. An absent Origin
// passes: the mobile app's fetch, the admin MCP's bearer calls and Stripe's webhook send none.
// Better Auth (/api/auth) checks origins against its trustedOrigins itself, and Carrel's site
// API is a bearer-key server call, so neither comes through this.
app.use("/api/v1/*", async (c, next) => refuseCrossSite(c.req.raw) ?? next());

// Search-as-you-type answers do not depend on the viewer (public books, profiles and
// clubs only), so they come from the edge cache for everyone, signed in or not.
app.get("/api/v1/search/suggest", async (c, next) => {
  const cache = edgeCache();
  const key = suggestKeyFor(new URL(c.req.url));
  const hit = await cache.match(key);
  if (hit) return hit;
  await next();
  if (c.res.status === 200) c.executionCtx.waitUntil(cache.put(key, c.res.clone()));
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
  const mediaRequest = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(mediaRequest);
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
  c.executionCtx.waitUntil(cache.put(mediaRequest, res.clone()));
  return res;
});

// The Journal's media library (app/lib/carrel/journal-media-adapter.server.ts): the pictures Carrel
// uploads for Journal posts, from the MEDIA bucket under journal/ only, so no other key (a reader
// asset, say) is ever served from here. A replace or a turn keeps the address, so browsers keep a
// copy an hour at most, and revalidate by the object's etag.
app.get("/media/journal/*", async (c) => {
  let key: string;
  try {
    key = decodeURIComponent(new URL(c.req.url).pathname.slice("/media/".length));
  } catch {
    return c.notFound();
  }
  if (key.split("/").some((part) => part === "" || part === "." || part === ".."))
    return c.notFound();
  const object = await c.env.MEDIA.get(key, { onlyIf: c.req.raw.headers });
  if (!object) return c.notFound();
  const headers = new Headers({
    "Cache-Control": "public, max-age=3600",
    ETag: object.httpEtag,
  });
  object.writeHttpMetadata(headers);
  if (!("body" in object)) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
});

app.all("*", async (c) => {
  const req = c.req.raw;
  const url = new URL(req.url);
  // One address per page: /books/ answers with a redirect to /books.
  const slash = slashRedirect(req);
  if (slash) return slash;
  // Legacy path 301s (GET navigations only). Preserve the query string; one hop.
  if (req.method === "GET") {
    const target = legacyRedirectTarget(url.pathname);
    if (target) {
      const dest = new URL(target, url.origin);
      dest.search = url.search;
      return c.redirect(dest.toString(), 301);
    }
  }
  // An anonymous GET of a public page goes through the Workers cache: the Renderer's response is
  // stored under the path and query, and a stored one is answered without rendering. A Better Auth
  // session cookie means the page may be personalized, so a signed-in request is rendered here,
  // never served from or stored in the cache.
  const ctx = c.executionCtx as unknown as ExecutionContext;
  const signedIn = (req.headers.get("Cookie") ?? "").includes("better-auth");
  if (req.method === "GET" && isPublicPath(url.pathname) && !signedIn) {
    // No Renderer entrypoint (the vitest pool runs the Worker without ctx.exports): render a copy
    // here, as the Renderer would see it, stored nowhere.
    const renderer = (ctx.exports as Partial<Cloudflare.Exports> | undefined)?.Renderer;
    const page = renderer
      ? await renderer.fetch(req, { cf: { cacheKey: cacheKey(url) } })
      : await renderShared(new Request(req), c.env, ctx);
    return forReader(page, req);
  }
  return storedNowhere(await renderPage(req, c.env, ctx));
});

/** A page rendered by React Router, with the security headers and the Early Hints Link header. */
async function renderPage(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env, ctx });
  context.set(cspNonceContext, cspNonceFor(request));
  // The policy is set here with the nonce the page was rendered with, so a stored page keeps it and
  // withSecurityHeaders, run again on the way out (handleFetch), re-issues a fresh one per reader.
  const res = withSecurityHeaders(await reactRouterHandler(request, context), request);
  // Early Hints: on a zone with Early Hints on, a page carrying a preload Link header is answered with a 103 first,
  // so the browser starts the render-blocking stylesheet while the Worker still renders (site-runtime ./preload).
  if (res.headers.get("Content-Type")?.startsWith("text/html")) {
    const stylesheets = (await serverBuild()).assets.routes.root?.css ?? [];
    const { header } = preloads(stylesheets.map((href) => ({ href, as: "style" as const })));
    if (header) res.headers.append("Link", header);
  }
  return res;
}

/** The Renderer's answer: a page the cache may store only when its route marked it shared and it is a 200 with no cookie. */
async function renderShared(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const page = await renderPage(request, env, ctx);
  if (page.headers.has("Set-Cookie")) page.headers.set("Cache-Control", UNCACHED);
  return settleCacheHeaders(page);
}

/** A page rendered in the gateway (signed in, or not a public path) is stored nowhere, even under a shared route. */
function storedNowhere(response: Response): Response {
  const settled = settleCacheHeaders(response);
  if (settled.headers.get("Cache-Control") === SHARED_CACHE_CONTROL) {
    settled.headers.set("Cache-Control", UNCACHED);
    settled.headers.delete(EDGE_CACHE_HEADER);
    settled.headers.delete("Cache-Tag");
  }
  return settled;
}

/**
 * The cacheable entrypoint (wrangler.jsonc.example, `exports`): the public pages, rendered and then
 * stored by the Workers cache under the key the gateway names. Only the gateway calls it, and only
 * for an anonymous GET of a public path.
 */
export class Renderer extends WorkerEntrypoint<Env> {
  override fetch(request: Request): Promise<Response> {
    return renderShared(request, this.env, this.ctx);
  }

  /** Drops every stored page. Called over RPC from the gateway, which stores nothing; RPC methods bypass the cache. */
  async purgePages(why: string): Promise<void> {
    await purgeTags(this.ctx.cache, [PAGES_CACHE_TAG], why);
  }
}

// The companion cache pipeline. Cron finds catalog books missing a cached action
// and enqueues one message per book; the queue consumer generates the 4 free-cached
// actions for that book and writes book_ai_cache. Both reuse the same core functions
// the manual proof script and the admin ops route call (one generation code path).
type CacheJobMessage = { bookId: string };

// The push delivery sweep. Runs on a frequent cron: it push-delivers notifications
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
  await push.sweepPushDeliveries(db, { fetchImpl: fetch, nowUtcMs: now, kv }, since);
  // Only a sweep that finished moves the cursor: a thrown one is retried from the same
  // point on the next tick instead of skipping its window (Grok audit 2026-10-21, FX-10).
  await kv.put("push:last_sweep", String(now));
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
  const caller = anthropicCaller(env);

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
// The rate limiter behind @foxing/api's rateLimit (the RATE_LIMITER binding).
export { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

// THE GATEWAY (wrangler.jsonc.example, `exports.default`, cache disabled): it runs on every request.
// Security headers on every response this Worker sends: pages, API, redirects, errors, 404s and
// stored pages (workers/security-headers.ts). Applied outside Hono, on what app.fetch returns:
// Hono's own error and not-found answers included, and no middleware can copy an older header back.
async function handleFetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  return withSecurityHeaders(await app.fetch(request, env, ctx), request);
}

export default { fetch: handleFetch, scheduled, queue };
