// Carrel's site API on the Worker, mounted by site-api's siteApiStep (workers/app.ts). The key reaches only
// /api/carrel/v1 (guards in order: prefix, rate limit, key, route); a preview link carries no key, its token is the address.
// Outside the prefix a request presenting the key is refused first (carrelKeyOffPrefix), so the key can never stand in for
// a session on an admin, user, club or /api/v1 route.

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
 * One site API over the Journal for a Carrel request, a preview link and the cron alike: site-api's standard store and
 * hooks (writes are safe to resend under their change id; failed hooks are retried by the cron). A missing
 * CARREL_RATE_LIMIT binding throws in the limiter, which answers 503: it fails closed rather than unlimited.
 * `kit` is the gateway's, for a request: a preview draws the journal route in-process with the post handed to it, with no
 * nonce, so no script of it runs. The cron passes none.
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

export const carrelStep: GatewayStep<Env> = siteApiStep<Env>((env, kit, request) =>
  carrelSiteApi(env, request.headers.get("cf-connecting-ip"), kit),
);

/** The per-minute cron's job: puts due scheduled posts live, reruns failed hooks, deletes posts 30 days in the trash and prunes the replay store. A failed schedule fails the job and retries next minute. */
export async function runCarrelSchedules(env: Env, now: Date): Promise<void> {
  await carrelSiteApi(env, null).runSchedulesOrThrow({ now });
}

/** The first gateway step: a request outside the prefix presenting the Carrel key as bearer is refused 401 (constant-time check; an unset or short key matches nothing). */
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
