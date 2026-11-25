// Each Cron Trigger's jobs: name, how often its trigger fires and how long a run may take. Keys must match wrangler.jsonc
// triggers.crons; workers/app.ts gives each job its work, and /health's cron check reads the same list. A trigger's jobs
// share one invocation, which Cloudflare stops at fifteen minutes; a job past its timeout is recorded failed.
export const CRON_TRIGGERS = {
  "17 3 * * *": [
    { name: "backup", backup: true, everyMinutes: 1440, timeoutMs: 5 * 60_000 },
    { name: "media-backup", backup: true, everyMinutes: 1440, timeoutMs: 6 * 60_000 },
    { name: "prune-404", everyMinutes: 1440, timeoutMs: 60_000 },
    { name: "prune-auth-events", everyMinutes: 1440, timeoutMs: 60_000 },
    { name: "prune-activity", everyMinutes: 1440, timeoutMs: 60_000 },
  ],
  "*/5 * * * *": [{ name: "push-sweep", everyMinutes: 5, timeoutMs: 4 * 60_000 }],

  "* * * * *": [{ name: "carrel-schedules", everyMinutes: 1, timeoutMs: 50_000 }],
  // Daily; the COVERS copy has its own trigger so the nightly one stays inside its fifteen minutes.
  "0 8 * * *": [
    { name: "prune-expired-auth", everyMinutes: 1440, timeoutMs: 60_000 },
    { name: "companion-cache", everyMinutes: 1440, timeoutMs: 60_000 },
    { name: "companion-fact-check", everyMinutes: 1440, timeoutMs: 60_000 },
    { name: "page-dates", everyMinutes: 1440, timeoutMs: 2 * 60_000 },
    { name: "covers-backup", backup: true, everyMinutes: 1440, timeoutMs: 6 * 60_000 },
  ],
} as const;

export type CronJobName = (typeof CRON_TRIGGERS)[keyof typeof CRON_TRIGGERS][number]["name"];

export const CRON_WATCHED: ReadonlyArray<{ name: CronJobName; everyMinutes: number }> =
  Object.values(CRON_TRIGGERS).flat();
