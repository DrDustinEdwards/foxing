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
import { createSiteBackup } from "@dustinedwards/d1-dump";
import {
  BACKUP_COUNTED_TABLES,
  BACKUP_CREDENTIAL_ALLOW,
  BACKUP_EXCLUDE,
  BACKUP_REQUIRED_TABLES,
} from "./backup-checks";

/**
 * Dump, check, then mark complete and prune, by d1-dump's runCheckedBackup. Its `counted` check
 * reads each counted table's live count straight after the dump and fails a run whose dumped rows
 * differ, or whose counted tables all dumped empty. A dump that fails its
 * checks is left WITHOUT the marker (kept as evidence, never counted as the latest) and throws
 * BackupIncomplete, so the failure shows as a failed Cron invocation and the health age keeps
 * growing toward its 26 hour warning. Pruning keeps d1-dump's default retention: the newest
 * complete run of each of the last 14 days, 8 ISO weeks and 6 months.
 *
 * The Journal library's earlier and deleted bytes (journal-media-adapter.server.ts) sit in BACKUPS under
 * journal-media/, outside files/, so Amazon's copy would never take them. They are copied under
 * files/journal-revisions/ in the same bucket, where the revert path keeps reading the originals.
 * /health reports each pass under `files` by name: journal, covers and journal-revisions.
 */
const backup = createSiteBackup<Env>({
  dump: {
    exclude: [...BACKUP_EXCLUDE],
    required: [...BACKUP_REQUIRED_TABLES],
    counted: [...BACKUP_COUNTED_TABLES],
    // d1-dump refuses a dump holding a column named for a credential (a token, a password, a
    // secret, a key or a refresh or code hash) unless it is excluded above or allowed with a reason.
    credentials: { allow: BACKUP_CREDENTIAL_ALLOW },
  },
  files: [
    { name: "journal", prefix: "journal/", source: (env) => env.MEDIA },
    { name: "covers", source: (env) => env.COVERS },
    {
      name: "journal-revisions",
      prefix: "journal-media/",
      source: (env) => env.BACKUPS,
    },
  ],
});

export const runBackup = async (env: Env): Promise<void> => void (await backup.runBackup(env));

export const runMediaBackup = (env: Env) =>
  backup.runFilesBackup(env, ["journal", "journal-revisions"]);

export const runCoversBackup = (env: Env) => backup.runFilesBackup(env, ["covers"]);

/** The newest complete dump's age, with each files pass under `files` by name, for /health. Warns past 26 hours. Never throws. */
export const backupStatus = (env: Env, now?: Date) => backup.status(env, now);
