// Carrel's site API (@dustinedwards/site-api) on the Worker: the Journal adapter, the CARREL_SITE_KEY secret and the
// CARREL_RATE_LIMIT binding, with its preview links at /preview/<token>, mounted by site-api's siteApiStep
// (workers/app.ts). The key reaches only /api/carrel/v1; a preview link carries no key, its token is the address, and
// it shows one post's current source until it expires or Carrel revokes it. Inside the prefix the package guards in
// order: prefix, rate limit, key, route. Outside it, a request that presents the key is refused before any other step
// runs (carrelKeyOffPrefix), so the key can never stand in for a session on an admin, user, club or /api/v1 route, now
// or after a later change to how sessions are read.

import {
  insidePrefix,
  MIN_KEY_LENGTH,
  type SiteApi,
  siteApiStep,
  standardSiteApi,
  type StepKit,
} from "@dustinedwards/site-api";
import { safeEqual } from "@dustinedwards/site-runtime/compare";
import { OWASP_EVENTS, logEvent, requestFields } from "@dustinedwards/site-runtime/log";
import type { GatewayStep } from "@dustinedwards/site-runtime/worker";
import { journalPreviewContext } from "../../context";
import { INDEXNOW_KEY } from "../indexnow";
import { SITE_ORIGIN } from "../origins";
import { journalSiteAdapter } from "./journal-adapter.server";

/**
 * One site API over the Journal, for a Carrel request, a preview link and the cron alike: site-api's standard store
 * (packages/core/migrations/0011_site_api_store.sql) and hooks. The store makes every write safe to send again under
 * its change id, keeps the preview links and the webmentions each post sent, and holds a failed hook for the cron to
 * retry. The hooks run after a write that changes a public page: a published change tells IndexNow at once (a request
 * from a preview origin sends nothing), the pages a post links to hear of it by webmention, and a schedule the cron
 * puts live purges the stored pages (the gateway purges after a Carrel write itself). A missing CARREL_RATE_LIMIT
 * binding throws in the limiter, which the package answers 503: the API fails closed rather than running unlimited.
 *
 * `kit` is the gateway's, for a request: a preview draws the journal route in-process at its own address, through the
 * shared render, with the post handed to the route (journalPreviewContext). It carries no nonce, as a stored public
 * page carries none, so the page is the server's HTML and no script of it runs. The cron passes none.
 */
function carrelSiteApi(env: Env, sourceIp: string | null, kit?: StepKit): SiteApi {
  return standardSiteApi({
    adapter: journalSiteAdapter({
      env,
      sourceIp,
      ...(kit
        ? {
            renderPreview: (slug, post) =>
              kit.render(
                new Request(`${kit.url.origin}/journal/${slug}`, {
                  headers: { accept: "text/html" },
                }),
                { set: (context) => context.set(journalPreviewContext, post) },
              ),
          }
        : {}),
    }),
    key: env.CARREL_SITE_KEY,
    limiter: env.CARREL_RATE_LIMIT,
    db: env.DB,
    indexNow: { origin: SITE_ORIGIN, key: INDEXNOW_KEY },
    hooks: (standard) => [standard.indexNow, standard.webmention, standard.purge],
  });
}

/** The gateway step for /api/carrel/v1 and the preview links; an accepted write purges the stored pages. */
export const carrelStep: GatewayStep<Env> = (request, env, ctx, kit) =>
  siteApiStep<Env>((e, stepKit) =>
    carrelSiteApi(e, request.headers.get("cf-connecting-ip"), stepKit),
  )(request, env, ctx, kit);

/**
 * The per-minute cron's job (workers/app.ts): every scheduled post and update whose time has come goes live, with the
 * hooks a Carrel publish runs; the hooks that failed earlier run again; the posts 30 days in the trash are deleted; and
 * the replay store is pruned. A schedule that fails fails the job, and is tried next minute.
 */
export async function runCarrelSchedules(env: Env, now: Date): Promise<void> {
  await carrelSiteApi(env, null).runSchedulesOrThrow({ now });
}

/**
 * The first gateway step: a request outside the prefix that presents the Carrel key as its bearer token is refused,
 * 401. Compared by site-runtime's constant-time digest check; an unset or short key matches nothing.
 */
export const carrelKeyOffPrefix: GatewayStep<Env> = async (request, env) => {
  if (insidePrefix(new URL(request.url).pathname)) return undefined;
  const header = request.headers.get("authorization");
  const presented = header ? /^Bearer[ ]+(\S+)\s*$/i.exec(header)?.[1] : undefined;
  if (!presented) return undefined;
  const key = env.CARREL_SITE_KEY?.trim() ?? "";
  if (key.length < MIN_KEY_LENGTH || !(await safeEqual(presented, key))) return undefined;
  logEvent(
    OWASP_EVENTS.authorizationFailure,
    { ...requestFields(request), reason: "carrel-key-off-prefix" },
    { level: "warn" },
  );
  return Response.json(
    { error: "unauthorized", message: "The Carrel key is accepted only under /api/carrel/v1." },
    { status: 401 },
  );
};
