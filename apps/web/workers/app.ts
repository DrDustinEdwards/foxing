// Single Worker entry. Hono is the root fetch handler and delegates:
//   /api/carrel/v1/* -> Carrel's site API over the Journal (app/lib/carrel), and its /preview/<token> links
//   /api/auth/*  -> Better Auth
//   /api/v1/*    -> mounted @foxing/api (thin routes -> core -> D1)
//   everything   -> React Router SSR
// Order matters: API routes register before the React Router catch-all.
// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { WorkerEntrypoint } from "cloudflare:workers";
import {
  ACCESS_LOGOUT_PATH,
  accessAdmin,
  adminEmails,
  withAdminIdle,
} from "@dustinedwards/site-runtime/access";
import { ADMIN_LIST_PATH, adminListResponse } from "@dustinedwards/site-runtime/access-drift";
import { runJobs } from "@dustinedwards/site-runtime/cron";
import {
  SHARED_CACHE_CONTROL,
  cacheKey,
  forReader,
  forRenderer,
  privateRender,
  purgeAfterWrite,
  settleCacheHeaders,
  UNCACHED,
  withPurgePages,
} from "@dustinedwards/site-runtime/edge-cache";
import { logEvent, withRequestLog } from "@dustinedwards/site-runtime/log";
import { countNotFound, pruneNotFound } from "@dustinedwards/site-runtime/not-found";
import { refuseCrossSite } from "@dustinedwards/site-runtime/origin";
import {
  SPECULATION_RULES_HEADER,
  SPECULATION_RULES_PATH,
  speculationRulesResponse,
} from "@dustinedwards/site-runtime/prefetch";
import { preloads, rootStylesheets, withPreloadHeader } from "@dustinedwards/site-runtime/preload";
import { timedRender } from "@dustinedwards/site-runtime/server-timing";
import { pruneAuthEvents } from "@dustinedwards/site-runtime/sign-in";
import { canonicalRedirect } from "@dustinedwards/site-runtime/url";
import { createApi } from "@foxing/api";
import { billing, catalogRepo, companion, createDb, push } from "@foxing/core";
import { Hono } from "hono";
import { RouterContextProvider, type ServerBuild, createRequestHandler } from "react-router";
import { cloudflareContext, cspNonceContext } from "../app/context";
import { anthropicCaller, anthropicStructured } from "../app/lib/anthropic.server";
import { edgeCache } from "../app/lib/cache.server";
import { images } from "../app/lib/images";
import {
  deleteUserAccount,
  getAuth,
  isFreshSession,
  sessionUserFromRequest,
} from "../app/lib/auth.server";
import { mountCarrel, runCarrelSchedules } from "../app/lib/carrel/site-api.server";
import { FONT_PRELOADS } from "../app/lib/preloads";
import { legacyRedirectTarget } from "../app/lib/redirects";
import { runBackup, runCoversBackup, runMediaBackup } from "../app/lib/backup.server";
import { CRON_TRIGGERS, type CronJobName } from "../app/lib/cron-jobs";
import { clubRoomHub } from "./club-room";
import {
  CSP_REPORT_PATH,
  OLD_CSP_REPORT_PATH,
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

/**
 * Hover prefetch (site-runtime ./prefetch): the paths beyond the package's own exclusions (/admin, /api, /auth,
 * sign-out and /cdn-cgi; links to files and links with a query). The signed-in app only sends a signed-out reader on
 * to /login, and the reader is a heavy app of its own; /sign-in/confirm spends a one-time sign-in link; /join/:code and
 * /find-next-book act on a GET (a club join; KV and an AI call). /lists covers the signed-in index and /lists/new as
 * well as a public list.
 */
const PREFETCH_EXCLUDE = [
  "/home",
  "/me",
  "/settings",
  "/library",
  "/shelves",
  "/onboarding",
  "/passkey",
  "/sign-in",
  "/clubs",
  "/join",
  "/feed",
  "/people",
  "/diary",
  "/lists",
  "/notifications",
  "/vocabulary",
  "/commonplace",
  "/highlights",
  "/stats",
  "/goals",
  "/year",
  "/find-next-book",
  "/companion-test",
  "/read",
  "/og",
];

/** A Better Auth session cookie: the page may be personalized, and a signed-in reader's pages never prefetch. */
function hasSession(request: Request): boolean {
  return (request.headers.get("Cookie") ?? "").includes("better-auth");
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
  // The reader's own deletion is Better Auth's deleteUser (app/lib/auth.server.ts).
  isFresh: (req, env) => isFreshSession(req, env as unknown as Env),
  deleteUser: (req, env, { successors }) =>
    deleteUserAccount(req, env as unknown as Env, successors),
  // Cloudflare Access must have signed the request for this admin's own email (site-runtime ./access).
  checkAdminAccess: async (req, env, email) =>
    (await accessAdmin(req, env as unknown as Env, { admins: [email] })) !== null,
  // ANTHROPIC_API_KEY is not set as a Worker secret yet (Phase 4a precheck). Every
  // other route works normally; only an actual companion call fails, cleanly, until
  // `wrangler secret put ANTHROPIC_API_KEY` runs.
  resolveStructuredCaller: (env) => anthropicStructured(env as unknown as Env),
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
  // The live layer: one ClubRoom Durable Object per club (clubRoomHub). The DO never writes D1.
  resolveHub: (env) => clubRoomHub((env as unknown as Env).CLUB_ROOM),
});

const app = new Hono<{ Bindings: Env }>();

// The writes that can change a stored page: Carrel's (the Journal and its pictures) and the admin
// API's (catalog, picks, awards, book of the month), the admin MCP's included. Each accepted one
// purges every stored page; a failed purge is a log line and a page stale until it expires. A purge
// reaches only the cache of the entrypoint that calls it, so the Renderer runs it, over RPC.
const PAGE_WRITERS = ["/api/carrel/v1", "/api/v1/admin"];
app.use("*", async (c, next) => {
  await next();
  const { pathname } = new URL(c.req.url);
  if (!PAGE_WRITERS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
  // No Renderer entrypoint in the vitest pool, which runs the Worker without ctx.exports.
  const ctx = c.executionCtx as unknown as ExecutionContext;
  if ((ctx.exports as Partial<Cloudflare.Exports> | undefined)?.Renderer)
    purgeAfterWrite(c.req.raw, c.res, ctx, `${c.req.method} ${pathname}`);
});

// The Content-Security-Policy report sink the policy names, and its old path, which pages cached
// before the move still name.
app.post(CSP_REPORT_PATH, (c) => handleCspReport(c.req.raw, c.env));
app.post(OLD_CSP_REPORT_PATH, (c) => handleCspReport(c.req.raw, c.env));

// Carrel's site API at /api/carrel/v1, mounted first: its off-prefix refusal must run before
// every other route, so the Carrel key is refused on auth, /api/v1 and page routes alike.
mountCarrel(app, async () => rootStylesheets(await serverBuild()).map((s) => s.href));

// Better Auth: sign-in, sessions, passkeys. Its own limiter holds sign-in to a few tries a
// minute per address, counted in D1 (site-runtime ./sign-in). Its answers carry sessions and
// passkey challenges, so no browser or proxy keeps one (checklist D10).
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const answer = await (await getAuth(c.env)).handler(c.req.raw);
  // A copy, since a redirect's headers are immutable.
  const res = new Response(answer.body, answer);
  if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", UNCACHED);
  return res;
});

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

// Every picture a page shows (app/lib/images.ts): covers from the COVERS bucket under covers/, and the
// Journal's media library (app/lib/carrel/journal-media-adapter.server.ts) from MEDIA under journal/
// only, so no other key (a reader asset, say) is ever served from here. A size is a year-long
// immutable copy; a Journal address without its `v` (a replace or a turn keeps the key) an hour.
app.get("/media/*", async (c) => {
  let key: string;
  try {
    key = decodeURIComponent(new URL(c.req.url).pathname.slice("/media/".length));
  } catch {
    return c.notFound();
  }
  if (key.split("/").some((part) => part === "" || part === "." || part === ".."))
    return c.notFound();
  const [bucket, stored] = key.startsWith("covers/")
    ? [c.env.COVERS, key.slice("covers/".length)]
    : key.startsWith("journal/")
      ? [c.env.MEDIA, key]
      : [null, ""];
  if (!bucket) return c.notFound();
  const versioned = key.startsWith("covers/") || c.req.query("v") !== undefined;
  return images.respond(c.req.raw, {
    object: await bucket.get(stored),
    images: c.env.IMAGES,
    cache: edgeCache(),
    reread: () => bucket.get(stored),
    ...(versioned ? {} : { cacheControl: "public, max-age=3600" }),
  });
});

// The prefetch rules every signed-out page's Speculation-Rules header names (handleFetch): one file, the same for every
// page, so no route renders it.
app.get(SPECULATION_RULES_PATH, (c) =>
  speculationRulesResponse({ exclude: PREFETCH_EXCLUDE }, c.req.raw),
);

app.all("*", async (c) => {
  const req = c.req.raw;
  const url = new URL(req.url);
  // One hop to the canonical address: https, the bare host, no trailing slash (/books/ to /books).
  const canonical = canonicalRedirect(req, { host: "foxing.app" });
  // Legacy path 301s (GET navigations only), from the canonical address so /sign-in/ is one hop
  // too. The query string is kept.
  const dest = new URL(canonical?.headers.get("Location") ?? url);
  const legacy = req.method === "GET" ? legacyRedirectTarget(dest.pathname) : null;
  if (legacy) {
    dest.pathname = legacy;
    return c.redirect(dest.toString(), 301);
  }
  if (canonical) return canonical;
  // An anonymous GET or HEAD of a public page goes through the Workers cache: the Renderer's response is
  // stored under the path and the query without tracking parameters, and a stored one is answered
  // without rendering (a 304 to a reader who already holds it). A Better Auth session cookie means
  // the page may be personalized, so a signed-in request is rendered here, never served from or
  // stored in the cache. A HEAD reaches the Renderer as a GET (forRenderer), so a stored page is a whole one, and
  // forReader gives the HEAD reader no body.
  const ctx = c.executionCtx as unknown as ExecutionContext;
  const signedIn = hasSession(req);
  if ((req.method === "GET" || req.method === "HEAD") && isPublicPath(url.pathname) && !signedIn) {
    // No Renderer entrypoint (the vitest pool runs the Worker without ctx.exports): render a copy
    // here, as the Renderer would see it, stored nowhere.
    const renderer = (ctx.exports as Partial<Cloudflare.Exports> | undefined)?.Renderer;
    const page = renderer
      ? await renderer.fetch(forRenderer(req), { cf: { cacheKey: cacheKey(url) } })
      : await renderShared(forRenderer(req), c.env, ctx);
    return forReader(page, req);
  }
  return storedNowhere(await renderPage(req, c.env, ctx));
});

/** A page rendered by React Router, with the security headers, Server-Timing and the Early Hints Link header. */
async function renderPage(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env, ctx });
  context.set(cspNonceContext, cspNonceFor(request));
  // The policy is set here with the nonce the page was rendered with, so a stored page keeps it and
  // withSecurityHeaders, run again on the way out (handleFetch), re-issues a fresh one per reader.
  const res = await timedRender(async () =>
    withSecurityHeaders(await reactRouterHandler(request, context), request),
  );
  // Early Hints: on a zone with Early Hints on, a page carrying a preload Link header is answered with a 103 first,
  // so the browser starts the render-blocking stylesheet and the first faces while the Worker still renders
  // (site-runtime ./preload). A book page's own Link (its cover) comes first.
  return withPreloadHeader(
    res,
    preloads([...rootStylesheets(await serverBuild()), ...FONT_PRELOADS]).header,
  );
}

/** The Renderer's answer: stored only when its route marked it shared and it is a 200 with no cookie either way. */
async function renderShared(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  return settleCacheHeaders(await renderPage(request, env, ctx), request);
}

/** A page rendered in the gateway (signed in, or not a public path) is stored nowhere, even under a shared route. */
function storedNowhere(response: Response): Response {
  const settled = settleCacheHeaders(response);
  return settled.headers.get("Cache-Control") === SHARED_CACHE_CONTROL
    ? privateRender(settled)
    : settled;
}

/**
 * The cacheable entrypoint (wrangler.jsonc.example, `exports`): the public pages, rendered and then
 * stored by the Workers cache under the key the gateway names. Only the gateway calls it, and only
 * for an anonymous GET of a public path.
 */
export class Renderer extends withPurgePages(WorkerEntrypoint<Env>) {
  override fetch(request: Request): Promise<Response> {
    return renderShared(request, this.env, this.ctx);
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
// unaffected.
const PUSH_SWEEP_LOOKBACK_MS = 10 * 60 * 1000;

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

async function enqueueCompanionCache(env: Env): Promise<void> {
  const db = createDb(env.DB);
  const limit = Number(env.COMPANION_CACHE_BATCH_SIZE) || 20;
  const books = await catalogRepo.findBooksNeedingCache(db, companion.CACHED_ACTION_NAMES, limit);
  await Promise.all(
    books.map((book) =>
      env.COMPANION_CACHE_QUEUE.send({ bookId: book.id } satisfies CacheJobMessage),
    ),
  );
}

// Each job's work, by name; app/lib/cron-jobs.ts names each trigger's jobs with their intervals and
// timeouts, which /health's cron check reads too. A failed job fails the invocation (Cron Events
// shows it) after the others have run.
const CRON_RUNS: Record<CronJobName, (env: Env) => Promise<unknown>> = {
  backup: runBackup,
  "media-backup": runMediaBackup,
  "covers-backup": runCoversBackup,
  "prune-404": (env) => pruneNotFound(env.DB),
  "prune-auth-events": (env) => pruneAuthEvents(env.DB),
  "push-sweep": runPushSweep,
  "carrel-schedules": (env) => runCarrelSchedules(env, new Date()),
  "companion-cache": enqueueCompanionCache,
};

async function scheduled(event: ScheduledController, env: Env): Promise<void> {
  const jobs: readonly (typeof CRON_TRIGGERS)[keyof typeof CRON_TRIGGERS][number][] | undefined =
    CRON_TRIGGERS[event.cron as keyof typeof CRON_TRIGGERS];
  // A trigger with no job list is a misspelt key or a cron added to wrangler.jsonc alone: fail the
  // invocation loudly rather than run nothing in silence.
  if (!jobs) {
    logEvent("cron_trigger_unknown", { cron: event.cron }, { level: "error" });
    throw new Error(`no cron jobs for trigger "${event.cron}"`);
  }
  await runJobs(
    env.DB,
    jobs.map((job) => ({ ...job, run: () => CRON_RUNS[job.name](env) })),
  );
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
      logEvent(
        "companion_cache_failed",
        { book_id: message.body.bookId, error: err },
        { level: "error" },
      );
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
// A 404 to a page GET is counted per path and referring host (site-runtime ./not-found); an API's
// 404 is an answer about a record, not a broken link, so it is not.
async function handleFetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const response = withSecurityHeaders(await app.fetch(request, env, ctx), request);
  // Hover prefetch for a signed-out reader's pages, stored ones included (site-runtime ./prefetch).
  if (!hasSession(request) && (response.headers.get("Content-Type") ?? "").includes("text/html"))
    response.headers.set(SPECULATION_RULES_HEADER.name, SPECULATION_RULES_HEADER.value);
  if (!new URL(request.url).pathname.startsWith("/api/"))
    countNotFound(env.DB, request, response, ctx);
  return response;
}

// The admin pages and the browser admin APIs behind the same Access application.
const ADMIN_PAGES = "/admin";
const ADMIN_APIS = ["/api/v1/admin", "/api/v1/ops"];

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

// An admin idle for an hour is signed out of Access (site-runtime ./access), on the pages and
// the APIs alike. On a page the idle answer is the redirect to Access's logout. A fetch() would
// follow that redirect to the logout page and read its 200 as success, so on an API the answer
// is a 401 the admin screens show as their error instead; the next page load signs out. The
// admin MCP's service-binding calls carry no Access token, so the idle check never sees them.
async function withAdminIdleSignOut(request: Request, handle: () => Promise<Response>) {
  const res = await withAdminIdle(request, handle, { prefixes: [ADMIN_PAGES, ...ADMIN_APIS] });
  const { pathname } = new URL(request.url);
  if (res.status !== 302 || res.headers.get("Location") !== ACCESS_LOGOUT_PATH) return res;
  if (!ADMIN_APIS.some((prefix) => under(pathname, prefix))) return res;
  const idle = Response.json(
    {
      error: {
        code: "admin_idle",
        message: "You were signed out after an hour without activity. Reload the page to sign in.",
      },
    },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
  const cleared = res.headers.get("Set-Cookie");
  if (cleared) idle.headers.append("Set-Cookie", cleared);
  return withSecurityHeaders(idle, request);
}

// The admin list, hashed with a fresh salt, for the daily Access drift check (I2, devkit's
// access-drift workflow): only a GET Access let through with a service token gets it, anything
// else is 404 (site-runtime ./access-drift). It sits under /admin, inside the Access application,
// and outside the idle sign-out, which is for people.
async function adminList(request: Request, env: Env): Promise<Response> {
  const res = await adminListResponse(request, env, { admins: adminEmails(env) });
  return withSecurityHeaders(res, request);
}

// Every request writes one `request` line (site-runtime ./log's withRequestLog: path, status, ms and
// the deployed commit, never a query).
export default {
  fetch: withRequestLog(
    (request: Request, env: Env, ctx: ExecutionContext) =>
      new URL(request.url).pathname === ADMIN_LIST_PATH
        ? adminList(request, env)
        : withAdminIdleSignOut(request, () => handleFetch(request, env, ctx)),
    { sha: (env) => (env as { DEPLOY_SHA?: string }).DEPLOY_SHA },
  ),
  scheduled,
  queue,
};
