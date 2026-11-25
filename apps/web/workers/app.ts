// Steps in order: refuse the Carrel key off its prefix, Carrel's site API (/api/carrel/v1), then Foxing's Hono app
// (/api/auth, /api/v1, reader assets, pictures); anything it has no route for passes to the page (React Router).
// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { exports as workerExports, WorkerEntrypoint } from "cloudflare:workers";
import { kvPageRecord, trackPageDates } from "@drdustinedwards/site-helpers/lastmod";
import { markdownPath } from "@drdustinedwards/site-helpers/llms";
import { markdownCopies } from "@drdustinedwards/site-helpers/markdown-copy";
import { standardFiles } from "@drdustinedwards/site-helpers/files";
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
import {
  billing,
  catalogHealthDomain,
  catalogRepo,
  companion,
  companionRepo,
  createDb,
  push,
  socialRepo,
} from "@foxing/core";
import { Hono } from "hono";
import type { ServerBuild } from "react-router";
import {
  anthropicCaller,
  anthropicFactChecker,
  anthropicStructured,
} from "../app/lib/anthropic.server";
import { edgeCache } from "../app/lib/cache.server";
import { images } from "../app/lib/images";
import { HELLO_EMAIL, SITE_ORIGIN } from "../app/lib/origins";
import {
  deleteUserAccount,
  getAuth,
  isFreshSession,
  sessionUserFromRequest,
} from "../app/lib/auth.server";
import {
  carrelKeyOffPrefix,
  carrelStep,
  runCarrelSchedules,
} from "../app/lib/carrel/site-api.server";
import { INDEXNOW_KEY } from "../app/lib/indexnow";
import { readerAssetContentType } from "../app/lib/reader-asset-type";
import { ROBOTS_DISALLOW, SITE_NAME } from "../app/lib/seo";
import { FONT_PRELOADS } from "../app/lib/preloads";
import { operatorTools } from "../app/lib/operator.server";
import { runBackup, runCoversBackup, runMediaBackup } from "../app/lib/backup.server";
import { CRON_TRIGGERS, type CronJobName } from "../app/lib/cron-jobs";
import { PAGE_DATES_KEY, TRACKED_PAGES } from "../app/lib/page-dates";
import { problemResponse } from "@dustinedwards/site-runtime/http-errors";
import { clubRoomHub } from "./club-room";
import { withSecurityHeaders } from "./security-headers";

// Public catalog surfaces: an anonymous GET goes to the Renderer, whose shared responses the Workers cache stores.
// Prefixes match the path or a child (/books/x), not lookalikes (/booksy).
const PUBLIC_EXACT = new Set([
  "/",
  "/sitemap.xml",
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

/** Hover-prefetch exclusions beyond the package's own: routes that redirect, spend a one-time link, or act on GET. */
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
  "/read",
  "/og",
];

// Injected at build time (vite define): namespaces the search suggestions' cache per deploy.
declare const __CACHE_VERSION__: string;

function suggestKeyFor(url: URL): Request {
  const keyUrl = new URL(url.toString());
  keyUrl.searchParams.set("__v", __CACHE_VERSION__);
  return new Request(keyUrl.toString(), { method: "GET" });
}

const serverBuild = () => import("virtual:react-router/server-build") as Promise<ServerBuild>;

const api = createApi({
  resolveSession: (req, env) => sessionUserFromRequest(req, env as unknown as Env),
  isFresh: (req, env) => isFreshSession(req, env as unknown as Env),
  deleteUser: (req, env, { successors }) =>
    deleteUserAccount(req, env as unknown as Env, successors),
  checkAdminAccess: async (req, env, email) =>
    (await accessAdmin(req, env as unknown as Env, { admins: [email] })) !== null,
  // Without ANTHROPIC_API_KEY only companion calls fail, cleanly.
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
  // Without all four Stripe secrets the stub makes billing routes 503 and the pages offer no upgrade.
  resolveBilling: (env) => {
    const stripe = billing.stripeSettings(env as unknown as Env);
    if (!stripe)
      return { client: billing.notConfiguredBilling(), prices: { monthly: "", annual: "" } };
    return {
      client: billing.createStripeBilling({
        secretKey: stripe.secretKey,
        webhookSecret: stripe.webhookSecret,
      }),
      prices: stripe.prices,
    };
  },
  resolveHub: (env) => clubRoomHub((env as unknown as Env).CLUB_ROOM),
});

const app = new Hono<{ Bindings: Env }>();

// Not-found answers (a missing reader asset or picture) are plainNotFound, a real 404.
const PASS = "x-foxing-pass";
app.notFound(() => new Response(null, { status: 404, headers: { [PASS]: "1" } }));
const plainNotFound = () => new Response("Not found", { status: 404 });

// Better Auth answers carry sessions and passkey challenges, so no browser or proxy keeps one.
app.on(["GET", "POST"], "/api/auth/*", async (c) => authHandler(await getAuth(c.env), c.req.raw));

// Every write is an /api/v1 route that skips React Router's Origin check, so a cross-origin browser write is refused
// here. An absent Origin passes (mobile app, admin MCP bearer calls, Stripe's webhook).
app.use("/api/v1/*", async (c, next) => refuseCrossSite(c.req.raw) ?? next());

// Search-as-you-type answers do not depend on the viewer, so the edge cache serves everyone.
app.get("/api/v1/search/suggest", async (c, next) => {
  const cache = edgeCache();
  const key = suggestKeyFor(new URL(c.req.url));
  const hit = await cache.match(key);
  if (hit) return hit;
  await next();
  if (c.res.status === 200) c.executionCtx.waitUntil(cache.put(key, c.res.clone()));
});

app.route("/api/v1", api);

// Readium reader assets are served same-origin (no CORS for the HttpFetcher) from MEDIA under reader/<slug>/...;
// noindex keeps duplicate book text out of search.
app.get("/reader-assets/*", async (c) => {
  const url = new URL(c.req.url);
  let rest: string;
  try {
    rest = decodeURIComponent(url.pathname.replace(/^\/reader-assets\//, ""));
  } catch {
    return plainNotFound(); // a malformed escape
  }
  if (!rest || rest.includes("..")) return plainNotFound();

  const cache = edgeCache();
  // stored=2 abandons copies cached while stored pages lacked the XML declaration's closing "?" (immutable, so they would live a year).
  const mediaRequest = new Request(`${url.toString()}${url.search ? "&" : "?"}stored=2`, {
    method: "GET",
  });
  if (c.req.method === "GET") {
    const cached = await cache.match(mediaRequest);
    if (cached) return cached;
  }
  const res = await r2ObjectResponse(c.req.raw, readerAssets(c.env.MEDIA, rest), `reader/${rest}`, {
    cacheControl: IMMUTABLE_CACHE,
    noindex: true,
  });
  if (res.status === 200 && c.req.method === "GET")
    c.executionCtx.waitUntil(cache.put(mediaRequest, res.clone()));
  return res;
});

/**
 * The MEDIA bucket as the reader's files. A book's own scripts never run: Readium's frames are same-origin, so the
 * CSP ('self') would let an EPUB's external <script src> load; text/plain plus nosniff makes the browser refuse it.
 */
function readerAssets(bucket: R2Bucket, path: string) {
  const typed = <T extends R2Object | null>(object: T): T => {
    if (!object) return object;
    return new Proxy(object, {
      get(target, property) {
        if (property === "writeHttpMetadata")
          return (headers: Headers) => {
            target.writeHttpMetadata(headers);
            const stored = headers.get("Content-Type") ?? readerAssetContentType(path);
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

// Covers from COVERS under covers/ and the Journal's media from MEDIA under journal/ only, so no other key is served
// here. A size is a year-long immutable copy; a Journal address without its `v` (a replace keeps the key) an hour.
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

// Writes that can change a stored page beside Carrel's (the admin API, MCP included, and a reader's visibility: a
// profile going private must drop its cached recap card). Each accepted one purges every stored page.
const PAGE_WRITERS = ["/api/v1/admin", "/api/v1/me/visibility"];

const hono: GatewayStep<Env> = async (request, env, ctx, kit) => {
  const answer = await app.fetch(request, env, ctx);
  if (answer.headers.has(PASS)) return undefined;
  const { pathname } = kit.url;
  if (PAGE_WRITERS.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    kit.purgeAfterWrite(request, answer, `${request.method} ${pathname}`);
  return answer;
};

type CacheJobMessage = { bookId: string; factCheck?: true };

// Push sweep: kept off the notification write path so core stays binding-free.
const PUSH_SWEEP_LOOKBACK_MS = 10 * 60 * 1000;

async function runPushSweep(env: Env): Promise<void> {
  const db = createDb(env.DB);
  const kv = env.APP_KV;
  const now = Date.now();
  const lastRaw = await kv.get("push:last_sweep");
  const since = lastRaw ? Number(lastRaw) : now - PUSH_SWEEP_LOOKBACK_MS;
  await push.sweepPushDeliveries(db, { fetchImpl: fetch, nowUtcMs: now, kv }, since);
  // Only a finished sweep moves the cursor: a thrown one retries from the same point.
  await kv.put("push:last_sweep", String(now));
}

const CACHE_LAST_BATCH_KEY = "companion-cache:last-batch";

// A consumer whose model calls all fail would leave this job "ok" and /health green, so books come back
// oldest-updated first: a batch still uncached on the next run means nothing was written, and the job fails.
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

// Daily; while KV `companion-fact-check:only` holds a JSON array of book ids only those are checked (delete it to sweep).
// A run inside FACT_CHECK_HOLD_SECONDS of the last does nothing: the queue is slow and would double-bill the same books.
const FACT_CHECK_BATCH = 1500;
const FACT_CHECK_ONLY_KEY = "companion-fact-check:only";
const FACT_CHECK_HOLD_KEY = "companion-fact-check:enqueued";
const FACT_CHECK_HOLD_SECONDS = 20 * 60 * 60;
async function enqueueFactCheck(env: Env): Promise<void> {
  if (await env.APP_KV.get(FACT_CHECK_HOLD_KEY)) return;
  const db = createDb(env.DB);
  const only = (await env.APP_KV.get(FACT_CHECK_ONLY_KEY, "json")) as string[] | null;
  const books = await companionRepo.findBooksNeedingFactCheck(
    db,
    FACT_CHECK_BATCH,
    only ?? undefined,
  );
  await Promise.all(
    books.map((book) =>
      env.COMPANION_CACHE_QUEUE.send({
        bookId: book.id,
        factCheck: true,
      } satisfies CacheJobMessage),
    ),
  );
  if (books.length)
    await env.APP_KV.put(FACT_CHECK_HOLD_KEY, new Date().toISOString(), {
      expirationTtl: FACT_CHECK_HOLD_SECONDS,
    });
}

const CRON_RUNS: Record<CronJobName, (env: Env) => Promise<unknown>> = {
  backup: runBackup,
  "media-backup": runMediaBackup,
  "covers-backup": runCoversBackup,
  "prune-404": (env) => pruneNotFound(env.DB),
  "prune-auth-events": (env) => pruneAuthEvents(env.DB),
  "prune-activity": (env) => socialRepo.pruneActivity(createDb(env.DB)),
  "push-sweep": runPushSweep,
  "carrel-schedules": (env) => runCarrelSchedules(env, new Date()),
  "companion-cache": enqueueCompanionCache,
  "companion-fact-check": enqueueFactCheck,
  "prune-expired-auth": (env) => pruneExpiredAuth(env.DB),
  "page-dates": runPageDates,
};

const withRun =
  (env: Env) =>
  (job: (typeof CRON_TRIGGERS)[keyof typeof CRON_TRIGGERS][number]): CronJob => ({
    ...job,
    run: () => CRON_RUNS[job.name](env),
  });

function cronJobs(env: Env): CronJob[] {
  return Object.values(CRON_TRIGGERS).flat().map(withRun(env));
}

function cronLists(env: Env): Record<string, CronJob[]> {
  return Object.fromEntries(
    Object.entries(CRON_TRIGGERS).map(([cron, jobs]) => [cron, jobs.map(withRun(env))]),
  );
}

async function factCheckMessage(
  db: ReturnType<typeof createDb>,
  checker: companion.FactChecker | null,
  message: Message<CacheJobMessage>,
): Promise<void> {
  if (!checker) return message.retry();
  try {
    const book = await catalogRepo.getBookById(db, message.body.bookId);
    const result = book && (await companion.factCheckBook(db, checker, book));
    if (result) logEvent("companion_fact_checked", { ...result });
    message.ack();
  } catch (err) {
    const limited = err instanceof Error && err.message.includes("(rate_limited)");
    logEvent(
      "companion_fact_check_failed",
      {
        book_id: message.body.bookId,
        error: err,
        reply_tail: (err as { replyTail?: string }).replyTail,
      },
      { level: limited ? "warn" : "error" },
    );
    // Every attempt is billed, so a failing book is given up after three; a reply cut off at max_tokens recurs.
    const cutOff = err instanceof Error && err.message.includes("(truncated)");
    if (cutOff || message.attempts >= 3) return message.ack();
    message.retry({ delaySeconds: 60 * message.attempts });
  }
}

async function queue(
  batch: MessageBatch<CacheJobMessage>,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const db = createDb(env.DB);
  const caller = anthropicCaller(env);
  const checker = anthropicFactChecker(env);

  for (const message of batch.messages) {
    if (message.body.factCheck) {
      await factCheckMessage(db, checker, message);
      continue;
    }
    if (!caller) {
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
        // Template filler would only teach the model a line that describes nothing.
        description: catalogHealthDomain.isTemplateDescription(book.description)
          ? null
          : book.description,
        publicationYear: book.publicationYear,
        subjects: book.subjects,
      });
      message.ack();
    } catch (err) {
      // A rate limit is the queue outrunning the quota, not a fault: warn and retry later (a minute longer each attempt).
      const limited = err instanceof Error && err.message.includes("(rate_limited)");
      logEvent(
        "companion_cache_failed",
        { book_id: message.body.bookId, error: err },
        { level: limited ? "warn" : "error" },
      );
      // A billed failed reply or prose-check failure recurs, so give up after three; the next daily run picks it up.
      if (limited) message.retry({ delaySeconds: 60 * message.attempts });
      else if (message.attempts >= 3) message.ack();
      else message.retry();
    }
  }
}

// Must be a named export of the entry module so the runtime can instantiate it for CLUB_ROOM.
export { ClubRoom } from "./club-room";
export { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

// Prelum's markdownCopies: public pages answer Accept: text/markdown and at path + .md; only signed-out-readable
// pages are in llms-full.txt.
async function runPageDates(env: Env) {
  // A cron has no request context; the gateway reads the Renderer from ctx.exports, so the Worker's own loopback goes there.
  const ctx = {
    waitUntil() {},
    passThroughOnException() {},
    props: {},
    exports: workerExports,
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

const ADMIN_PAGES = "/admin";
const ADMIN_APIS = ["/api/v1/admin", "/api/v1/ops"];

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

// An idle admin is signed out of Access. A fetch() would follow the logout redirect and read its 200 as success, so
// an API answers 401 instead. The admin MCP's service-binding calls carry no Access token and skip the check.
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

// Hashed admin list for the daily Access drift check: only a service-token GET gets it, else 404. Outside the idle sign-out.
async function adminList(request: Request, env: Env): Promise<Response> {
  const res = await adminListResponse(request, env, { admins: adminEmails(env) });
  return withSecurityHeaders(res, request);
}

const site = defineSite<Env>({
  name: "Foxing",
  serverBuild,
  mode: import.meta.env.MODE,
  withSecurityHeaders,
  canonical: { host: "foxing.app" },
  files: standardFiles({
    origin: SITE_ORIGIN,
    disallow: ROBOTS_DISALLOW,
    indexNowKey: INDEXNOW_KEY,
    ai: { name: "Foxing", contact: HELLO_EMAIL },
    manifest: { name: SITE_NAME, themeColor: "#B04A1C", backgroundColor: "#FAF6EE" },
  }),
  speculationExclude: PREFETCH_EXCLUDE,
  operator: (env) => operatorTools(env, () => cronJobs(env)),
  steps: [carrelKeyOffPrefix, carrelStep, hono],
  cacheable: (_request, url) => isPublicPath(url.pathname),
  preloads: [...FONT_PRELOADS],
  // A Journal post Carrel deleted or trashed answers 410 (gone_paths); an API's 404 stays one.
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

/** The cacheable entrypoint (`exports`): public pages the Workers cache stores, called only by the gateway. */
export class Renderer extends siteRenderer(WorkerEntrypoint<Env>, site) {}

// The queue consumer goes in beside the shared fetch and cron, so Sentry (site-runtime ./sentry) wraps it too.
const worker = siteWorker(site, { queue });

export default worker satisfies ExportedHandler<Env, CacheJobMessage>;
