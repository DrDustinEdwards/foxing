// Nightly D1 backup, run from the Worker's scheduled handler (wrangler.jsonc triggers.crons).
// d1-dump writes one JSON object per table into the BACKUPS R2 bucket and works where
// `wrangler d1 export` fails on our FTS5 tables. The MEDIA bucket's objects (the EPUBs, reader
// assets and the Journal's pictures) are copied beside the dumps under files/media/ by d1-dump's
// backupFiles, each run going on where the last stopped. Restore and drill: the d1-dump README.
import {
  type BackupHealth,
  backupFiles,
  backupHealth,
  filesHealth,
  runCheckedBackup,
} from "@dustinedwards/d1-dump";
import { BACKUP_COUNTED_TABLES, BACKUP_EXCLUDE, BACKUP_REQUIRED_TABLES } from "./backup-checks";

const MEDIA_BACKUP = { name: "media" };

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

export async function runMediaBackup(env: Env): Promise<void> {
  await backupFiles(env.MEDIA, env.BACKUPS, MEDIA_BACKUP);
}

/** The newest complete dump's age, with the media pass's under `files`, for /health. Warns past 26 hours. Never throws. */
export async function backupStatus(
  env: Env,
  now?: Date,
): Promise<BackupHealth & { files: BackupHealth }> {
  const [dump, files] = await Promise.all([
    backupHealth(env.BACKUPS, { now }),
    filesHealth(env.BACKUPS, { ...MEDIA_BACKUP, now }),
  ]);
  const warning = dump.warning ?? (files.warning && `media files: ${files.warning}`);
  return { ...dump, files, ...(warning ? { warning } : {}) };
}
