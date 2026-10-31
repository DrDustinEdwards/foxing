import { cronCheck } from "@dustinedwards/site-runtime/cron";
import {
  aiCheck,
  durableObjectCheck,
  healthResponse,
  imagesCheck,
  kvCheck,
  queueCheck,
  r2Check,
} from "@dustinedwards/site-runtime/health";
import { cloudflareContext } from "~/context";
import { backupStatus } from "~/lib/backup.server";
import { CRON_WATCHED } from "~/lib/cron-jobs";
import type { Route } from "./+types/health";

// GET /health for uptime monitors and the Capsid console: site-runtime's response. FAIL LEVEL IS D1
// ALONE: without it no page, sign-in or API answer works, so 503 is true. Everything else warns,
// because the catalog still renders without it: the newest dump or a files pass older than 26 hours
// (under `backup`), the MEDIA and COVERS buckets, APP_KV, Images (cover and journal picture sizes),
// Workers AI and the companion cache queue (the companion only), the ClubRoom and rate limiter
// Durable Objects (live club updates, and the API's limits), and a cron job that failed, overran,
// went stale or never ran (`cron_runs`, against app/lib/cron-jobs.ts). durableObjectCheck mints an
// id and sends nothing, queueCheck sends nothing and aiCheck runs nothing, so none is billed. Left
// out: EMAIL (send_email has nothing to read, and a probe would send mail) and CARREL_RATE_LIMIT
// (the rate-limiting binding has no read, and a probe would spend Carrel's budget). `sha` is the
// deployed commit, which CI's deploy passes as DEPLOY_SHA (devkit's worker-deploy.yml; a manual
// deploy has none).
export function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const deployed = env.CF_VERSION_METADATA?.timestamp;
  return healthResponse({
    ping: () => env.DB.prepare("SELECT 1").first(),
    backup: () => backupStatus(env),
    sha: (env as { DEPLOY_SHA?: string }).DEPLOY_SHA,
    checks: [
      r2Check("media", env.MEDIA),
      r2Check("covers", env.COVERS),
      kvCheck("kv", env.APP_KV),
      imagesCheck("images", env.IMAGES),
      aiCheck("ai", env.AI),
      queueCheck("companion-queue", env.COMPANION_CACHE_QUEUE),
      durableObjectCheck("club-room", env.CLUB_ROOM),
      durableObjectCheck("rate-limiter", env.RATE_LIMITER),
      // The deploy's time holds a job back until its first window since the deploy has passed.
      cronCheck(env.DB, {
        jobs: [...CRON_WATCHED],
        deployedAt: deployed ? new Date(deployed) : undefined,
      }),
    ].map((check) => ({ ...check, level: "warn" as const })),
  });
}
