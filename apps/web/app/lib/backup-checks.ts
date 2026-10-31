// What the nightly dump must leave out, carry and count (d1-dump's runCheckedBackup checks them).
//
// EXCLUDED on purpose, because each holds live credentials or one-time tokens. A backup copy
// is one more place a credential could leak from, and restoring one revives it:
//   session       Better Auth sessions: a bearer `token` per row, plus IP and user agent.
//   verification  Better Auth one-time values: magic links, sign-in codes, email checks.
//   account       The Google and Apple sign-in links (their tokens are never stored, but the
//                 column exists). Better Auth recreates the row at the next Google or Apple
//                 sign-in, and the email link and passkeys need none.
// Passkeys are KEPT: the table holds only public keys, and a restore without them would
// leave every reader to add theirs again.
//   push_tokens   Expo push tokens: anyone holding one can push to that device. The app
//                 registers its token again after sign-in (POST /api/v1/push/register).
//   preview_links Carrel's preview links (site-api's store): the hash of each link's token.
//                 Restoring an older copy would bring back a link revoked since; a lost link
//                 is made again in Carrel.
// KEPT: user, profiles, books, annotations, journal_posts and every other table.
// The FTS5 tables (books_fts, annotations_fts) are not excluded: d1-dump never dumps their
// shadow tables and dumps these internal-content ones through their columns with rowid.
// test/backup.integration.test.ts derives the credential tables from the migrated schema and
// fails if this list is missing one or names an extra one. d1-dump also fails the run on an
// excluded name that is not a table, so a table dropped by a migration leaves this list too.
export const BACKUP_EXCLUDE = [
  "session",
  "verification",
  "account",
  "push_tokens",
  "preview_links",
] as const;

// Hand-written content that exists nowhere else, plus the catalog. Each must be in the dump.
export const BACKUP_REQUIRED_TABLES = [
  "user",
  "profiles",
  "books",
  "annotations",
  "journal_posts",
] as const;

// Written by the operator, not by readers, so the count read straight after the dump matches
// unless the dump lost rows. Reader-written tables can change between the two reads. A run whose
// counted tables all dumped empty fails too: Foxing always has catalog books and journal posts.
export const BACKUP_COUNTED_TABLES = ["books", "journal_posts"] as const;
