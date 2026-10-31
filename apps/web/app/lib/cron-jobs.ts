// Each Cron Trigger's jobs: name, how often its trigger fires and how long a run may take. The keys
// must match wrangler.jsonc triggers.crons. workers/app.ts gives each job its work and runs the list
// through site-runtime's runJobs (each isolated, timed and recorded in cron_runs); /health's cron
// check reads the same list, so a job whose trigger never fires warns as "never ran".
//
// Timeouts: a trigger's jobs share one invocation, which Cloudflare stops at fifteen minutes. The
// nightly dump and the media pass (d1-dump's own five-minute budget) take the most; a job past its
// timeout is recorded failed and the next one starts.
export const CRON_TRIGGERS = {
  // Nightly: dump D1, copy the MEDIA bucket's new and changed objects, prune the 404 counts and
  // the sign-in events (site-runtime pruneAuthEvents: a deleted user's after 30 days, all after a year).
  "17 3 * * *": [
    { name: "backup", everyMinutes: 1440, timeoutMs: 5 * 60_000 },
    { name: "media-backup", everyMinutes: 1440, timeoutMs: 6 * 60_000 },
    { name: "prune-404", everyMinutes: 1440, timeoutMs: 60_000 },
    { name: "prune-auth-events", everyMinutes: 1440, timeoutMs: 60_000 },
  ],
  "*/5 * * * *": [{ name: "push-sweep", everyMinutes: 5, timeoutMs: 4 * 60_000 }],
  // Every minute: Carrel's site API puts due scheduled posts and updates live, retries the publish
  // hooks that failed, empties the content trash of posts 30 days in it, and prunes its replay
  // store (app/lib/carrel/site-api.server.ts).
  "* * * * *": [{ name: "carrel-schedules", everyMinutes: 1, timeoutMs: 50_000 }],
  // Daily: enqueue catalog books needing cached AI generation, and copy the COVERS bucket (its own
  // trigger, so the nightly one stays inside its fifteen minutes).
  "0 8 * * *": [
    { name: "companion-cache", everyMinutes: 1440, timeoutMs: 60_000 },
    { name: "covers-backup", everyMinutes: 1440, timeoutMs: 6 * 60_000 },
  ],
} as const;

export type CronJobName = (typeof CRON_TRIGGERS)[keyof typeof CRON_TRIGGERS][number]["name"];

/** Every job on every trigger, for /health's cron check. */
export const CRON_WATCHED: ReadonlyArray<{ name: CronJobName; everyMinutes: number }> =
  Object.values(CRON_TRIGGERS).flat();
