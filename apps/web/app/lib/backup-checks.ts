// What the nightly dump must leave out and carry, and Foxing's own checks on it. Pure (no
// bindings) so the tests can hand it a bad dump and watch each check fail.
//
// EXCLUDED on purpose, because each holds live credentials or one-time tokens. A backup copy
// is one more place a credential could leak from, and restoring one revives it:
//   session       Better Auth sessions: a bearer `token` per row, plus IP and user agent.
//   verification  Better Auth one-time values: magic links, password resets, email checks.
//   account       OAuth access, refresh and id tokens, and the password hash. Better Auth
//                 recreates the row at the next Google or magic-link sign-in; a password
//                 user sets a new password through /forgot-password after a restore.
//   push_tokens   Expo push tokens: anyone holding one can push to that device. The app
//                 registers its token again after sign-in (POST /api/v1/push/register).
// KEPT: user, profiles, books, annotations, journal_posts and every other table.
// The FTS5 tables (books_fts, annotations_fts) are not excluded: d1-dump never dumps their
// shadow tables and dumps these internal-content ones through their columns with rowid.
// test/backup.integration.test.ts derives the credential tables from the migrated schema and
// fails if this list is missing one or names an extra one. d1-dump also fails the run on an
// excluded name that is not a table, so a table dropped by a migration leaves this list too.
export const BACKUP_EXCLUDE = ["session", "verification", "account", "push_tokens"] as const;

// Hand-written content that exists nowhere else, plus the catalog. Each must be in the dump.
export const BACKUP_REQUIRED_TABLES = [
  "user",
  "profiles",
  "books",
  "annotations",
  "journal_posts",
] as const;

// Written by the operator, not by readers, so the count read straight after the dump matches
// unless the dump lost rows. Reader-written tables can change between the two reads.
export const BACKUP_COUNTED_TABLES = ["books", "journal_posts"] as const;

export type DumpSummary = {
  tables: Array<{ name: string; rows: number }>;
};

/**
 * Foxing's own checks, run by d1-dump's runCheckedBackup after its standard ones (not empty,
 * nothing excluded present, every required table there). One message per failed check.
 */
export function countProblems(dump: DumpSummary, liveCounts: Record<string, number>): string[] {
  const problems: string[] = [];
  const byName = new Map(dump.tables.map((t) => [t.name, t.rows]));
  for (const name of BACKUP_COUNTED_TABLES) {
    const dumped = byName.get(name);
    const live = liveCounts[name];
    if (dumped === undefined) continue; // reported as missing by the required-table check
    if (live === undefined) problems.push(`no live count for ${name}`);
    else if (dumped !== live) problems.push(`${name} dumped ${dumped} rows but has ${live}`);
  }
  // An emptied database dumps cleanly and matches its own empty counts, so the counts alone
  // cannot catch it. Foxing always has catalog books and journal posts.
  if (BACKUP_COUNTED_TABLES.every((n) => (byName.get(n) ?? 0) === 0)) {
    problems.push("every counted table dumped empty");
  }
  return problems;
}
