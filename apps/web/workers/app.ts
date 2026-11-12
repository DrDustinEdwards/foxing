// The Worker is site-runtime's shared one (./worker). Foxing's Hono app is its one step, and answers:
//   /api/carrel/v1/* -> Carrel's site API over the Journal (app/lib/carrel), and its /preview/<token> links
//   /api/auth/*  -> Better Auth
//   /api/v1/*    -> mounted @foxing/api (thin routes -> core -> D1)
//   /reader-assets/*, /media/* -> the reader's book files and every picture
// Anything it has no route for passes on to the page (React Router, through the Renderer when public).
// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { WorkerEntrypoint } from "cloudflare:workers";
import { kvPageRecord, trackPageDates } from "@drdustinedwards/site-helpers/lastmod";
import { markdownPath } from "@drdustinedwards/site-helpers/llms";
import { markdownCopies } from "@drdustinedwards/site-helpers/markdown-copy";
import { d1SiteApiStore, tombstoned } from "@dustinedwards/site-api/store";
import {
  ACCESS_LOGOUT_PATH,
  accessAdmin,
  adminEmails,
  withAdminIdle,
} from "@dustinedwards/site-runtime/access";
import { ADMIN_LIST_PATH, adminListResponse } from "@dustinedwards/site-runtime/access-drift";
import type { CronJob } from "@dustinedwards/site-runtime/cron";
import { authHandler } from "@dustinedwards/site-runtime/sign-in-form";
import { IMMUTABLE_CACHE } from "@dustinedwards/site-runtime/image";
import { r2ObjectResponse } from "@dustinedwards/site-runtime/r2-object";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { pruneNotFound } from "@dustinedwards/site-runtime/not-found";
import { refuseCrossSite } from "@dustinedwards/site-runtime/origin";
import { pruneAuthEvents, pruneExpiredAuth } from "@dustinedwards/site-runtime/sign-in";
import {
  defineSite,
  siteRenderer,
  siteWorker,
  type FetchHandler,
  type GatewayStep,
} from "@dustinedwards/site-runtime/worker";
import { createApi } from "@foxing/api";
import { billing, catalogRepo, companion, createDb, push } from "@foxing/core";
import { Hono } from "hono";
import { type ServerBuild, createRequestHandler } from "react-router";
import { anthropicCaller, anthropicStructured } from "../app/lib/anthropic.server";
import { edgeCache } from "../app/lib/cache.server";
import { images } from "../app/lib/images";
import { SITE_ORIGIN } from "../app/lib/origins";
import {
  deleteUserAccount,
  getAuth,
  isFreshSession,
  sessionUserFromRequest,
} from "../app/lib/auth.server";
import { mountCarrel, runCarrelSchedules } from "../app/lib/carrel/site-api.server";
import { FONT_PRELOADS } from "../app/lib/preloads";
import { operatorTools } from "../app/lib/operator.server";
import { runBackup, runCoversBackup, runMediaBackup } from "../app/lib/backup.server";
import { CRON_TRIGGERS, type CronJobName } from "../app/lib/cron-jobs";
import { PAGE_DATES_KEY, TRACKED_PAGES } from "../app/lib/page-dates";
import { problemResponse } from "@dustinedwards/site-runtime/http-errors";
import { clubRoomHub } from "./club-room";
import { withSecurityHeaders } from "./security-headers";

// The public catalog surfaces: an anonymous GET of one goes to the Renderer, whose responses the
// Workers cache stores when the route marks them shared (publicPageHeaders). Segment prefixes match
// the path or any child (/books, /books/x), not lookalikes (/booksy).
const PUBLIC_EXACT = new Set([
  "/",
  "/sitemap.xml",
  "/robots.txt",
  "/privacy",
  "/terms",
  "/accessibility",
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

// Injected at build time (vite define). Namespaces the search suggestions' cache per deploy.
declare const __CACHE_VERSION__: string;

/** The search suggestions' cache key: the request URL plus the build id, so a new deploy starts fresh. */
function suggestKeyFor(url: URL): Request {
  const keyUrl = new URL(url.toString());
  keyUrl.searchParams.set("__v", __CACHE_VERSION__);
  return new Request(keyUrl.toString(), { method: "GET" });
}

const serverBuild = () => import("virtual:react-router/server-build") as Promise<ServerBuild>;
// A Carrel preview draws the journal route in-process with its own context (app/lib/carrel/site-api.server.ts),
// never through the Renderer, whose answers the edge stores.
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
    // oxlint-disable-next-line eslint/require-yield -- throws on first iteration by design, never yields
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

// Anything the app has no route for passes on to the page (the step below maps this answer to undefined). Its own
// "not found" answers (a missing reader asset or picture) are plainNotFound, a real 404.
const PASS = "x-foxing-pass";
app.notFound(() => new Response(null, { status: 404, headers: { [PASS]: "1" } }));
const plainNotFound = () => new Response("Not found", { status: 404 });

// Carrel's site API at /api/carrel/v1, mounted first: its off-prefix refusal must run before
// every other route, so the Carrel key is refused on auth, /api/v1 and page routes alike.
mountCarrel(app, (request, context) => reactRouterHandler(request, context));

// Better Auth: sign-in, sessions, passkeys. Its own limiter holds sign-in to a few tries a
// minute per address, counted in D1 (site-runtime ./sign-in). Its answers carry sessions and
// passkey challenges, so no browser or proxy keeps one (checklist D10): site-runtime authHandler.
app.on(["GET", "POST"], "/api/auth/*", async (c) => authHandler(await getAuth(c.env), c.req.raw));

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
  if (!rest || rest.includes("..")) return plainNotFound();

  const cache = edgeCache();
  const mediaRequest = new Request(url.toString(), { method: "GET" });
  if (c.req.method === "GET") {
    const cached = await cache.match(mediaRequest);
    if (cached) return cached;
  }
  // site-runtime's r2ObjectResponse answers HEAD, ranges, 304 and the ETag; the reader's bucket view types each file.
  const res = await r2ObjectResponse(c.req.raw, readerAssets(c.env.MEDIA, rest), `reader/${rest}`, {
    cacheControl: IMMUTABLE_CACHE,
    noindex: true,
  });
  if (res.status === 200 && c.req.method === "GET")
    c.executionCtx.waitUntil(cache.put(mediaRequest, res.clone()));
  return res;
});

/**
 * The MEDIA bucket as the reader's files: each object's Content-Type is its stored one, else the type its extension
 * names. A book's own scripts never run: Readium's frames are same-origin, so the reader's CSP ('self') would let an
 * EPUB's external <script src> load from here; served as text/plain, nosniff makes the browser refuse to run it. (Its
 * inline scripts are refused by the CSP, which they carry no nonce for.)
 */
function readerAssets(bucket: R2Bucket, path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const typed = <T extends R2Object | null>(object: T): T => {
    if (!object) return object;
    return new Proxy(object, {
      get(target, property) {
        if (property === "writeHttpMetadata")
          return (headers: Headers) => {
            target.writeHttpMetadata(headers);
            const stored =
              headers.get("Content-Type") ??
              READER_ASSET_CONTENT_TYPES[ext] ??
              "application/octet-stream";
            headers.set(
              "Content-Type",
              /javascript|ecmascript/i.test(stored) ? "text/plain; charset=utf-8" : stored,
            );
          };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  };
  return {
    head: async (key: string) => typed(await bucket.head(key)),
    get: async (key: string, options?: { range?: Headers }) =>
      typed(await bucket.get(key, options)),
  };
}

// Every picture a page shows (app/lib/images.ts): covers from the COVERS bucket under covers/, and the
// Journal's media library (app/lib/carrel/journal-media-adapter.server.ts) from MEDIA under journal/
// only, so no other key (a reader asset, say) is ever served from here. A size is a year-long
// immutable copy; a Journal address without its `v` (a replace or a turn keeps the key) an hour.
app.get("/media/*", (c) =>
  images.serve(c.req.raw, {
    read: (key) =>
      key.startsWith("covers/")
        ? c.env.COVERS.get(key.slice("covers/".length))
        : key.startsWith("journal/")
          ? c.env.MEDIA.get(key)
          : Promise.resolve(null),
    images: c.env.IMAGES,
    cache: edgeCache(),
    cacheControl: ({ key, url }) =>
      key.startsWith("covers/") || url.searchParams.has("v")
        ? IMMUTABLE_CACHE
        : "public, max-age=3600",
  }),
);

// The writes that can change a stored page: Carrel's (the Journal and its pictures) and the admin API's (catalog,
// picks, awards, book of the month), the admin MCP's included. Each accepted one purges every stored page; a failed
// purge is a log line and a page stale until it expires.
const PAGE_WRITERS = ["/api/carrel/v1", "/api/v1/admin"];

/** The Hono app as the Worker's step: its answer, or undefined for a path it has no route for. */
const hono: GatewayStep<Env> = async (request, env, ctx, kit) => {
  const answer = await app.fetch(request, env, ctx);
  if (answer.headers.has(PASS)) return undefined;
  const { pathname } = kit.url;
  if (PAGE_WRITERS.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    kit.purgeAfterWrite(request, answer, `${request.method} ${pathname}`);
  return answer;
};

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

const CACHE_LAST_BATCH_KEY = "companion-cache:last-batch";

// Enqueues the next books that need their cached actions. The generation runs in the queue consumer, so a
// consumer whose model calls all fail would leave this job "ok" and /health green (the cache sat at 560 rows from
// 2026-11-02 while every call failed). The books come back oldest-updated first, so a batch whose books are
// ALL still uncached when the next run finds them means nothing was written: the job fails, and /health says so.
async function enqueueCompanionCache(env: Env): Promise<void> {
  const db = createDb(env.DB);
  const limit = Number(env.COMPANION_CACHE_BATCH_SIZE) || 200;
  const books = await catalogRepo.findBooksNeedingCache(db, companion.CACHED_ACTION_NAMES, limit);
  const ids = books.map((book) => book.id);
  const last = ((await env.APP_KV.get(CACHE_LAST_BATCH_KEY, "json")) as string[] | null) ?? [];
  const stalled = last.length > 0 && last.every((id) => ids.includes(id));
  await env.APP_KV.put(CACHE_LAST_BATCH_KEY, JSON.stringify(ids));
  await Promise.all(
    books.map((book) =>
      env.COMPANION_CACHE_QUEUE.send({ bookId: book.id } satisfies CacheJobMessage),
    ),
  );
  if (stalled)
    throw new Error(
      `the last batch of ${last.length} books is still uncached: the model calls are failing (see companion_cache_failed and anthropic_call in the logs)`,
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
  "prune-expired-auth": (env) => pruneExpiredAuth(env.DB),
  "page-dates": runPageDates,
};

/** A job from app/lib/cron-jobs.ts with its work. */
const withRun =
  (env: Env) =>
  (job: (typeof CRON_TRIGGERS)[keyof typeof CRON_TRIGGERS][number]): CronJob => ({
    ...job,
    run: () => CRON_RUNS[job.name](env),
  });

/** Every job on every trigger with its work: what the operator API's run_job runs now. */
function cronJobs(env: Env): CronJob[] {
  return Object.values(CRON_TRIGGERS).flat().map(withRun(env));
}

/** Each trigger's job list (app/lib/cron-jobs.ts) with its work, for the shared Worker's cron. */
function cronLists(env: Env): Record<string, CronJob[]> {
  return Object.fromEntries(
    Object.entries(CRON_TRIGGERS).map(([cron, jobs]) => [cron, jobs.map(withRun(env))]),
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
      // A rate limit is the queue running ahead of the model's quota, not a fault: warn, and retry later
      // (a minute longer each attempt) instead of at once. Anything else is an error.
      const limited = err instanceof Error && err.message.includes("(rate_limited)");
      logEvent(
        "companion_cache_failed",
        { book_id: message.body.bookId, error: err },
        { level: limited ? "warn" : "error" },
      );
      message.retry(limited ? { delaySeconds: 60 * message.attempts } : undefined);
    }
  }
}

// The ClubRoom Durable Object class must be a named export of the Worker's entry module
// so the runtime can instantiate it for the CLUB_ROOM binding.
export { ClubRoom } from "./club-room";
// The rate limiter behind @foxing/api's rateLimit (the RATE_LIMITER binding).
export { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

// Prelum's markdownCopies: each public page has a Markdown copy at its path plus .md and answers Accept: text/markdown,
// and /llms-full.txt is the prose pages in the sitemap's order. Only the pages a signed-out reader can read are listed
// here. The catalog's 1,400 book pages and 650 author pages are database records an agent fetches one at a time, so each
// has its copy but stays out of llms-full.txt, which leaves the hubs, the picks, the awards and the Journal.
/** Keeps the day each hub and code-written page last changed, from what its Markdown copy says: /sitemap.xml's lastmod. */
async function runPageDates(env: Env) {
  const ctx = {
    waitUntil() {},
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext;
  const store = kvPageRecord(env.APP_KV, PAGE_DATES_KEY);
  return trackPageDates({
    paths: [...TRACKED_PAGES],
    read: async (path) => {
      const response = await worker.fetch(
        new Request(`${SITE_ORIGIN}${markdownPath(path)}`),
        env,
        ctx,
      );
      return response.ok ? response.text() : null;
    },
    ...store,
  });
}

const COPIED = new Set([
  "/",
  "/about",
  "/accessibility",
  "/app-guide",
  "/awards",
  "/book-of-the-month",
  "/books",
  "/features",
  "/guide",
  "/journal",
  "/journal/archive",
  "/picks",
  "/privacy",
  "/terms",
]);
const COPIED_UNDER = ["/awards/", "/picks/", "/journal/", "/books/", "/authors/"];
const CATALOG = ["/books/", "/authors/"];
const withMarkdownCopies = (handler: FetchHandler<Env>) =>
  markdownCopies(handler, {
    origin: SITE_ORIGIN,
    siteMarkdown: false,
    llmsFullSkip: (path) => CATALOG.some((prefix) => path.startsWith(prefix)),
    skip: (path) =>
      path === "/journal/rss.xml" ||
      path.startsWith("/journal/tag/") ||
      !(COPIED.has(path) || COPIED_UNDER.some((prefix) => path.startsWith(prefix))),
  });

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
async function withAdminIdleSignOut(request: Request, env: Env, handle: () => Promise<Response>) {
  const res = await withAdminIdle(request, handle, {
    prefixes: [ADMIN_PAGES, ...ADMIN_APIS],
    secret: env.ADMIN_IDLE_SECRET,
  });
  const { pathname } = new URL(request.url);
  if (res.status !== 302 || res.headers.get("Location") !== ACCESS_LOGOUT_PATH) return res;
  if (!ADMIN_APIS.some((prefix) => under(pathname, prefix))) return res;
  const idle = problemResponse({
    status: 401,
    code: "admin_idle",
    detail: "You were signed out after an hour without activity. Reload the page to sign in.",
  });
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

/**
 * The site's Worker (site-runtime ./worker). What is Foxing's own: the Hono app as its one step (the APIs, Carrel, the
 * reader's files and the pictures), the public catalog paths the Renderer stores, its prefetch exclusions, Carrel's
 * tombstones on a page 404, the Markdown copies, the admin list and the API-aware idle sign-out (inside `wrap`, so it
 * runs before the copies, as before), and the cron's job lists.
 */
const site = defineSite<Env>({
  name: "Foxing",
  serverBuild,
  mode: import.meta.env.MODE,
  withSecurityHeaders,
  // One hop to the canonical address: https, the bare host, no trailing slash (/books/ to /books).
  canonical: { host: "foxing.app" },
  speculationExclude: PREFETCH_EXCLUDE,
  operator: (env) => operatorTools(env, () => cronJobs(env)),
  steps: [hono],
  cacheable: (_request, url) => isPublicPath(url.pathname),
  preloads: [...FONT_PRELOADS],
  // A Journal post Carrel deleted or trashed answers 410, not 404 (site-api tombstones, gone_paths); an API's 404 is
  // an answer about a record and stays one.
  onNotFound: (response, request, env) => {
    const { pathname } = new URL(request.url);
    return pathname.startsWith("/api/")
      ? response
      : tombstoned(response, pathname, d1SiteApiStore(env.DB));
  },
  wrap: (handler) => {
    const copies = withMarkdownCopies(handler);
    return (request, env, ctx) =>
      new URL(request.url).pathname === ADMIN_LIST_PATH
        ? adminList(request, env)
        : withAdminIdleSignOut(request, env, () => copies(request, env, ctx));
  },
  cron: (env) => cronLists(env),
});

/**
 * The cacheable entrypoint (wrangler.jsonc.example, `exports`): the public pages, rendered and then stored by the
 * Workers cache under the key the gateway names. Only the gateway calls it, for an anonymous read of a public path.
 */
export class Renderer extends siteRenderer(WorkerEntrypoint<Env>, site) {}

const worker = siteWorker(site);

export default { ...worker, queue } satisfies ExportedHandler<Env, CacheJobMessage>;
