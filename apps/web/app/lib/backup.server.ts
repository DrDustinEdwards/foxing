// Nightly D1 backup, run from the Worker's scheduled handler (wrangler.jsonc triggers.crons).
// d1-dump writes one JSON object per table into the BACKUPS R2 bucket and works where
// `wrangler d1 export` fails on our FTS5 tables. Restore and drill: the d1-dump README.
import { type BackupHealth, backupHealth, runCheckedBackup } from "@dustinedwards/d1-dump";
import { BACKUP_COUNTED_TABLES, BACKUP_EXCLUDE, BACKUP_REQUIRED_TABLES } from "./backup-checks";

/**
 * Dump, check, then mark complete and prune, by d1-dump's runCheckedBackup. Its `counted` check
 * reads each counted table's live count straight after the dump and fails a run whose dumped rows
 * differ, or whose counted tables all dumped empty. A dump that fails its
 * checks is left WITHOUT the marker (kept as evidence, never counted as the latest) and throws
 * BackupIncomplete, so the failure shows as a failed Cron invocation and the health age keeps
 * growing toward its 26 hour warning. Pruning keeps d1-dump's default retention: the newest
 * complete run of each of the last 14 days, 8 ISO weeks and 6 months.
 */
export async function runBackup(env: Env): Promise<void> {
  await runCheckedBackup(env.DB, env.BACKUPS, {
    exclude: [...BACKUP_EXCLUDE],
    required: [...BACKUP_REQUIRED_TABLES],
    counted: [...BACKUP_COUNTED_TABLES],
  });
}

/** Age of the newest complete dump, for /health. Warns past 26 hours. Never throws. */
export function backupStatus(env: Env, now?: Date): Promise<BackupHealth> {
  return backupHealth(env.BACKUPS, { now });
}
