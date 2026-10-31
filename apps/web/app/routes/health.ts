import { cronCheck } from "@dustinedwards/site-runtime/cron";
import {
  authSpikeCheck,
  healthResponse,
  kvCheck,
  r2Check,
} from "@dustinedwards/site-runtime/health";
import { cloudflareContext } from "~/context";
import { backupStatus } from "~/lib/backup.server";
import type { Route } from "./+types/health";

// GET /health for uptime monitors and the Capsid console: site-runtime's response, 503 only when D1
// does not answer. Warnings, never a 503: the newest dump or media files pass older than 26 hours
// (both under `backup`), the MEDIA bucket or APP_KV not answering (the catalog still renders), and
// a cron job that failed or stopped (`cron_runs`), and a spike of failed sign-ins or sign-in mails
// in the last hour (`auth_events`, site-runtime authSpikeCheck). `sha` is the deployed commit, which CI's deploy
// passes as DEPLOY_SHA (devkit's worker-deploy.yml; a manual deploy has none).
export function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return healthResponse({
    ping: () => env.DB.prepare("SELECT 1").first(),
    backup: () => backupStatus(env),
    sha: (env as { DEPLOY_SHA?: string }).DEPLOY_SHA,
    checks: [
      { ...r2Check("media", env.MEDIA), level: "warn" },
      { ...kvCheck("kv", env.APP_KV), level: "warn" },
      cronCheck(env.DB),
      authSpikeCheck(env.DB),
    ],
  });
}
