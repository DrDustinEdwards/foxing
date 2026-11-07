// The operator API's tools: the door Capsid Admin reaches Foxing through (/api/operator, site-runtime ./operator, one
// implementation on every site; workers/app.ts mounts it). Checking the backups, backing up now and running any
// scheduled job now are Capsid Admin's, for every site in one place (Dustin, 2026-11-06 and 2026-11-07), so they are
// not admin API routes here.
import { runJobTool, type CronJob } from "@dustinedwards/site-runtime/cron";
import type { OperatorTool } from "@dustinedwards/site-runtime/operator";
import { backupStatus } from "./backup.server";

/** `jobs` is every cron job with its work (workers/app.ts), for run_job. */
export function operatorTools(env: Env, jobs: () => CronJob[]): Record<string, OperatorTool> {
  return {
    backup_status: {
      description:
        "Reads the backup state now, uncached: the newest complete D1 dump's age and each files pass (journal, " +
        "journal-revisions, covers) with when it last completed, and a warning when any is past 26 hours.",
      // /health keeps its own field names; the operator answers in the shape every site's does: files by pass name.
      run: async () => {
        const { files, revisions, covers, ...dump } = await backupStatus(env);
        return { ...dump, files: { journal: files, "journal-revisions": revisions, covers } };
      },
    },
    run_job: runJobTool(env.DB, jobs),
  };
}
