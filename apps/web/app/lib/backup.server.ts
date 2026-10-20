// Nightly D1 backup, run from the Worker's scheduled handler (wrangler.jsonc triggers.crons).
// d1-dump writes one JSON object per table into the BACKUPS R2 bucket and works where
// `wrangler d1 export` fails on our FTS5 tables. Restore and drill: the d1-dump README.
import { type BackupHealth, backupHealth, runCheckedBackup } from "@dustinedwards/d1-dump";
import {
  BACKUP_COUNTED_TABLES,
  BACKUP_EXCLUDE,
  BACKUP_REQUIRED_TABLES,
  countProblems,
} from "./backup-checks";

async function liveCounts(db: D1Database): Promise<Record<string, number>> {
  const results = await db.batch<{ n: number }>(
    BACKUP_COUNTED_TABLES.map((name) => db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`)),
  );
  return Object.fromEntries(
    BACKUP_COUNTED_TABLES.map((name, i) => [name, results[i]?.results[0]?.n ?? 0]),
  );
}

/**
 * Dump, check, then mark complete and prune, by d1-dump's runCheckedBackup. A dump that fails its
 * checks is left WITHOUT the marker (kept as evidence, never counted as the latest) and throws
 * BackupIncomplete, so the failure shows as a failed Cron invocation and the health age keeps
 * growing toward its 26 hour warning. Pruning keeps d1-dump's default retention: the newest
 * complete run of each of the last 14 days, 8 ISO weeks and 6 months.
 */
export async function runBackup(env: Env): Promise<void> {
  await runCheckedBackup(env.DB, env.BACKUPS, {
    exclude: [...BACKUP_EXCLUDE],
    required: [...BACKUP_REQUIRED_TABLES],
    check: async (dump) => countProblems(dump, await liveCounts(env.DB)),
  });
}

/** Age of the newest complete dump, for /health. Warns past 26 hours. Never throws. */
export function backupStatus(env: Env, now?: Date): Promise<BackupHealth> {
  return backupHealth(env.BACKUPS, { now });
}
