// Nightly D1 backup from the scheduled handler. d1-dump writes one JSON object per table into BACKUPS (`wrangler d1 export`
// fails on our FTS5 tables); the Journal's pictures, COVERS and the Journal's earlier bytes are copied under files/ by
// backupFiles, and Capsid's off-account copy takes files/. Restore: the d1-dump README.
// NOT BACKED UP: APP_KV (caches, counters, the push cursor; rebuilt or restarted), CLUB_ROOM (fan-out only),
// RATE_LIMITER (expiring counters), BACKUPS (the copy itself), and MEDIA outside journal/ (public-domain EPUBs and
// exploded reader files, fetchable again; 3.4 GB in 73,000 files would never finish a pass).
import { createSiteBackup } from "@dustinedwards/d1-dump";
import {
  BACKUP_COUNTED_TABLES,
  BACKUP_CREDENTIAL_ALLOW,
  BACKUP_EXCLUDE,
  BACKUP_REQUIRED_TABLES,
} from "./backup-checks";

/**
 * Dump, check, then mark complete and prune (runCheckedBackup). A dump failing its checks is left without the marker and
 * throws BackupIncomplete, so the failure shows as a failed Cron and the health age grows toward its 26 hour warning.
 * The Journal's earlier and deleted bytes sit in BACKUPS journal-media/, outside files/, so they are copied to
 * files/journal-revisions/ in the same bucket, where the revert path keeps reading the originals.
 */
const backup = createSiteBackup<Env>({
  dump: {
    exclude: [...BACKUP_EXCLUDE],
    required: [...BACKUP_REQUIRED_TABLES],
    counted: [...BACKUP_COUNTED_TABLES],
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

export const backupStatus = (env: Env, now?: Date) => backup.status(env, now);
