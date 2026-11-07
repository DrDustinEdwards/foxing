// Nightly D1 backup, run from the Worker's scheduled handler (wrangler.jsonc triggers.crons).
// d1-dump writes one JSON object per table into the BACKUPS R2 bucket and works where
// `wrangler d1 export` fails on our FTS5 tables. The Journal's pictures (MEDIA under journal/) are
// copied beside the dumps under files/journal/, the COVERS bucket's objects under files/covers/, and
// the Journal's earlier and deleted bytes (BACKUPS journal-media/) under files/journal-revisions/,
// by d1-dump's backupFiles, each run going on where the last stopped. Capsid's nightly off-account
// copy takes files/ to Amazon. Restore and drill: the d1-dump README.
//
// NOT BACKED UP, and why:
//   APP_KV     caches (catalog, recommendations), the companion's daily counters (25-hour TTL), the
//              admin's confirmations (minutes) and the push sweep's cursor; each is rebuilt or
//              starts over, and a lost cursor sweeps the last ten minutes again.
//   CLUB_ROOM  fan-out only: it never writes, so it holds nothing to restore (workers/club-room.ts).
//   RATE_LIMITER  counters that expire within their window.
//   BACKUPS    the copy itself.
//   MEDIA outside journal/  the public-domain EPUBs (se/, pg*.epub) and their exploded reader files
//              (reader/, from scripts/explode-epubs). Dustin, 2026-11-05: they can be fetched again,
//              so they are not backed up; 3.4 GB in 73,000 files would also never finish a pass.
import {
  type BackupHealth,
  backupFiles,
  backupHealth,
  filesHealth,
  runCheckedBackup,
} from "@dustinedwards/d1-dump";
import {
  BACKUP_COUNTED_TABLES,
  BACKUP_CREDENTIAL_ALLOW,
  BACKUP_EXCLUDE,
  BACKUP_REQUIRED_TABLES,
} from "./backup-checks";

const JOURNAL_BACKUP = { name: "journal", prefix: "journal/" };
const COVERS_BACKUP = { name: "covers" };
// The Journal library's earlier and deleted bytes (journal-media-adapter.server.ts) sit in BACKUPS under
// journal-media/, outside files/, so Amazon's copy would never take them. They are copied under
// files/journal-revisions/ in the same bucket, where the revert path keeps reading the originals.
const REVISIONS_BACKUP = { name: "journal-revisions", prefix: "journal-media/" };

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
    // d1-dump refuses a dump holding a column named for a credential (a token, a password, a
    // secret, a key or a refresh or code hash) unless it is excluded above or allowed with a reason.
    credentials: { allow: BACKUP_CREDENTIAL_ALLOW },
  });
}

/** One files pass's answer: its name, whether it completed, and its counts. */
const passResult = (run: Awaited<ReturnType<typeof backupFiles>>) => ({
  name: run.name,
  complete: run.complete,
  ...run.counts,
});

export async function runMediaBackup(env: Env) {
  const journal = await backupFiles(env.MEDIA, env.BACKUPS, JOURNAL_BACKUP);
  const revisions = await backupFiles(env.BACKUPS, env.BACKUPS, REVISIONS_BACKUP);
  return { files: [passResult(journal), passResult(revisions)] };
}

export async function runCoversBackup(env: Env) {
  return { files: [passResult(await backupFiles(env.COVERS, env.BACKUPS, COVERS_BACKUP))] };
}

/** The newest complete dump's age, with the Journal pictures' pass under `files` and the covers pass's
 *  under `covers`, for /health. Warns past 26 hours. Never throws. */
export async function backupStatus(
  env: Env,
  now?: Date,
): Promise<BackupHealth & { files: BackupHealth; covers: BackupHealth; revisions: BackupHealth }> {
  const [dump, files, covers, revisions] = await Promise.all([
    backupHealth(env.BACKUPS, { now }),
    filesHealth(env.BACKUPS, { name: JOURNAL_BACKUP.name, now }),
    filesHealth(env.BACKUPS, { ...COVERS_BACKUP, now }),
    filesHealth(env.BACKUPS, { name: REVISIONS_BACKUP.name, now }),
  ]);
  const warning =
    dump.warning ??
    (files.warning && `journal files: ${files.warning}`) ??
    (covers.warning && `cover files: ${covers.warning}`) ??
    (revisions.warning && `journal revisions: ${revisions.warning}`);
  return { ...dump, files, covers, revisions, ...(warning ? { warning } : {}) };
}
