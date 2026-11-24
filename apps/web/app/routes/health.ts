import {
  aiOutcomeCheck,
  authSpikeCheck,
  durableObjectCheck,
  emailCheck,
  imagesCheck,
  kvCheck,
  queueCheck,
  r2Check,
  siteHealthResponse,
} from "@dustinedwards/site-runtime/health";
import { adminRepo, createDb } from "@foxing/core";
import { cloudflareContext } from "~/context";
import { backupStatus } from "~/lib/backup.server";
import { CRON_WATCHED } from "~/lib/cron-jobs";
import { COVER_ORIGIN } from "~/lib/origins";
import type { Route } from "./+types/health";

const CATALOG_DATA_KEY = "health:catalog-data";

// GET /health for uptime monitors and the Capsid console: site-runtime's siteHealthResponse. FAIL LEVEL IS D1
// ALONE: without it no page, sign-in or API answer works, so 503 is true. Everything else warns,
// because the catalog still renders without it: the newest dump or a files pass older than 26 hours
// (under `backup`), the MEDIA and COVERS buckets, APP_KV, Images (cover and journal picture sizes),
// the companion cache queue (the companion only), the last companion model call (`ai-companion`), the ClubRoom and rate limiter
// Durable Objects (live club updates, and the API's limits), and a cron job that failed, overran,
// went stale or never ran (`cron_runs`, against app/lib/cron-jobs.ts), and a spike of failed
// sign-ins or sign-in mails in the last hour (`auth_events`, site-runtime authSpikeCheck), and an invalid or shared ISBN
// or bad retailer link (`catalog-data`).
// durableObjectCheck mints an id and sends nothing, queueCheck and emailCheck send nothing, so none is
// billed or mails anyone. Left out: CARREL_RATE_LIMIT (the rate-limiting binding has no read, and a probe would spend
// Carrel's budget). `sha` is the deployed commit, which CI's deploy passes as DEPLOY_SHA (devkit's worker-deploy.yml; a manual
// deploy has none).
export function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return siteHealthResponse(env, {
    backup: () => backupStatus(env),
    jobs: [...CRON_WATCHED],
    checks: [
      r2Check("media", env.MEDIA),
      r2Check("covers", env.COVERS),
      kvCheck("kv", env.APP_KV),
      imagesCheck("images", env.IMAGES),
      emailCheck("email", env.EMAIL),
      queueCheck("companion-queue", env.COMPANION_CACHE_QUEUE),
      // The last real companion call failed (a spend cap, a revoked key): the queue above still answers then.
      aiOutcomeCheck("companion", env.APP_KV),
      // The last real Journal alt-text call failed.
      aiOutcomeCheck("alt-text", env.APP_KV),
      durableObjectCheck("club-room", env.CLUB_ROOM),
      durableObjectCheck("rate-limiter", env.RATE_LIMITER),
      authSpikeCheck(env.DB),
      {
        name: "catalog-data",
        // The check reads every book, so the monitor's polls share one result an hour.
        run: async () => {
          const cached = await env.APP_KV.get(CATALOG_DATA_KEY);
          if (cached !== null) {
            if (cached) throw new Error(cached);
            return;
          }
          const { checks } = await adminRepo.getCatalogHealth(createDb(env.DB), {
            coverOrigin: COVER_ORIGIN,
            skipAiText: true,
          });
          const bad = checks.filter((c) => c.count > 0 && /isbn|retailer/.test(c.check));
          const problem = bad.map((c) => c.check).join(", ");
          await env.APP_KV.put(CATALOG_DATA_KEY, problem, { expirationTtl: 3600 });
          if (problem) throw new Error(problem);
        },
      },
    ].map((check) => ({ ...check, level: "warn" as const })),
  });
}
