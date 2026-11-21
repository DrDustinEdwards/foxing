import { cronCheck } from "@dustinedwards/site-runtime/cron";
import {
  aiOutcomeCheck,
  authSpikeCheck,
  durableObjectCheck,
  emailCheck,
  healthResponse,
  imagesCheck,
  kvCheck,
  queueCheck,
  r2Check,
} from "@dustinedwards/site-runtime/health";
import { adminRepo, createDb } from "@foxing/core";
import { cloudflareContext } from "~/context";
import { backupStatus } from "~/lib/backup.server";
import { CRON_WATCHED } from "~/lib/cron-jobs";
import { COVER_ORIGIN } from "~/lib/origins";
import type { Route } from "./+types/health";
import { deployedAt, deployedSha } from "@dustinedwards/site-runtime/deploy";

// GET /health for uptime monitors and the Capsid console: site-runtime's response. FAIL LEVEL IS D1
// ALONE: without it no page, sign-in or API answer works, so 503 is true. Everything else warns,
// because the catalog still renders without it: the newest dump or a files pass older than 26 hours
// (under `backup`), the MEDIA and COVERS buckets, APP_KV, Images (cover and journal picture sizes),
// the companion cache queue (the companion only), the last companion model call (`ai-companion`), the ClubRoom and rate limiter
// Durable Objects (live club updates, and the API's limits), and a cron job that failed, overran,
// went stale or never ran (`cron_runs`, against app/lib/cron-jobs.ts), and a spike of failed
// sign-ins or sign-in mails in the last hour (`auth_events`, site-runtime authSpikeCheck), and book data that is
// wrong rather than missing (`catalog-data`: an invalid or shared ISBN, a bad retailer link).
// durableObjectCheck mints an id and sends nothing, queueCheck and emailCheck send nothing, so none is
// billed or mails anyone. Left out: CARREL_RATE_LIMIT (the rate-limiting binding has no read, and a probe would spend
// Carrel's budget). `sha` is the deployed commit, which CI's deploy passes as DEPLOY_SHA (devkit's worker-deploy.yml; a manual
// deploy has none).
export function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return healthResponse({
    ping: () => env.DB.prepare("SELECT 1").first(),
    backup: () => backupStatus(env),
    sha: deployedSha(env),
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
      // The deploy's time holds a job back until its first window since the deploy has passed.
      cronCheck(env.DB, {
        jobs: [...CRON_WATCHED],
        deployedAt: deployedAt(env),
      }),
      authSpikeCheck(env.DB),
      {
        name: "catalog-data",
        run: async () => {
          const { checks } = await adminRepo.getCatalogHealth(createDb(env.DB), {
            coverOrigin: COVER_ORIGIN,
          });
          const bad = checks.filter(
            (c) =>
              ["invalid_isbn", "duplicate_isbn", "bad_retailer_link"].includes(c.check) &&
              c.count > 0,
          );
          if (bad.length) throw new Error(bad.map((c) => `${c.count} ${c.check}`).join(", "));
        },
      },
    ].map((check) => ({ ...check, level: "warn" as const })),
  });
}
