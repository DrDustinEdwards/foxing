// Steps in order: refuse the Carrel key off its prefix, Carrel's site API (/api/carrel/v1), then Foxing's Hono app
// (/api/auth, /api/v1, reader assets, pictures); anything it has no route for passes to the page (React Router).
// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { exports as workerExports, WorkerEntrypoint } from "cloudflare:workers";
import { kvPageRecord, trackPageDates } from "@drdustinedwards/site-helpers/lastmod";
import { markdownPath } from "@drdustinedwards/site-helpers/llms";
import { markdownCopies } from "@drdustinedwards/site-helpers/markdown-copy";
import { standardFiles } from "@drdustinedwards/site-helpers/files";
import { d1SiteApiStore, tombstoned } from "@dustinedwards/site-api/store";
import { ACCESS_LOGOUT_PATH, adminEmails, withAdminIdle } from "@dustinedwards/site-runtime/access";
import { ADMIN_LIST_PATH, adminListResponse } from "@dustinedwards/site-runtime/access-drift";
import type { CronJob } from "@dustinedwards/site-runtime/cron";
import { pruneNotFound } from "@dustinedwards/site-runtime/not-found";
import { pruneAuthEvents, pruneExpiredAuth } from "@dustinedwards/site-runtime/sign-in";
import {
  defineSite,
  siteRenderer,
  siteWorker,
  type FetchHandler,
} from "@dustinedwards/site-runtime/worker";
import { createDb, socialRepo } from "@foxing/core";
import type { ServerBuild } from "react-router";
import { HELLO_EMAIL, SITE_ORIGIN } from "../app/lib/origins";
import {
  carrelKeyOffPrefix,
  carrelStep,
  runCarrelSchedules,
} from "../app/lib/carrel/site-api.server";
import { INDEXNOW_KEY } from "../app/lib/indexnow";
import { ROBOTS_DISALLOW, SITE_NAME } from "../app/lib/seo";
import { FONT_PRELOADS } from "../app/lib/preloads";
import { operatorTools } from "../app/lib/operator.server";
import { runBackup, runCoversBackup, runMediaBackup } from "../app/lib/backup.server";
import { CRON_TRIGGERS, type CronJobName } from "../app/lib/cron-jobs";
import { PAGE_DATES_KEY, TRACKED_PAGES } from "../app/lib/page-dates";
import { problemResponse } from "@dustinedwards/site-runtime/http-errors";
import {
  enqueueCompanionCache,
  enqueueFactCheck,
  queue,
  runPushSweep,
  type CacheJobMessage,
} from "./companion-jobs";
import { hono } from "./hono-step";
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

const serverBuild = () => import("virtual:react-router/server-build") as Promise<ServerBuild>;

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
