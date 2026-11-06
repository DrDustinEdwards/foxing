// The operator API's tools: the door Capsid Admin's backups reach Foxing through (/api/operator, site-runtime
// ./operator, one implementation on every site; workers/app.ts mounts it). Checking the backups and backing up now
// are Capsid Admin's, for every site in one place (Dustin, 2026-11-06), so they are not admin API routes here.
import type { OperatorTool } from "@dustinedwards/site-runtime/operator";
import { backupFilesNow, backupStatus } from "./backup.server";

export function operatorTools(env: Env): Record<string, OperatorTool> {
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
    backup_media: {
      description:
        "Runs the nightly files backup now: one pass each over the Journal's pictures, its earlier and deleted bytes, " +
        "and the book covers (files/journal/, files/journal-revisions/, files/covers/). Copy only; each pass goes on " +
        "where its last stopped.",
      run: async () => ({ files: await backupFilesNow(env) }),
    },
  };
}
