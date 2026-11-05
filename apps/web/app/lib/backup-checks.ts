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
// d1-dump's credential-column check (runBackup's `credentials`) fails the night on a dumped table
// with a column named for a token, password, secret or key hash, so a new one is excluded here or
// allowed below with its reason. d1-dump also fails the run on an excluded name that is not a
// table, so a table dropped by a migration leaves this list too.
export const BACKUP_EXCLUDE = [
  "session",
  "verification",
  "account",
  "push_tokens",
  "preview_links",
] as const;

// Columns whose names read as credentials but are safe in a dump.
export const BACKUP_CREDENTIAL_ALLOW: Record<string, string> = {
  "passkey.credential_id": "a passkey's public credential id; the table holds only public keys",
};

// Everything that exists nowhere else, so each must be in the dump: who the readers are and how
// they sign in, the catalog, and every reader's own writing and records (shelves, lists, notes,
// diary, sessions, goals, follows, clubs and their talk, the companion's threads), the Journal with
// its versions, redirects and pictures, the staff picks, billing events and the admin audit log.
export const BACKUP_REQUIRED_TABLES = [
  "user",
  "passkey",
  "profiles",
  "books",
  "book_awards",
  "book_of_the_month",
  "external_book_clubs",
  "external_book_club_picks",
  "annotations",
  "user_books",
  "user_book_tags",
  "user_favorites",
  "custom_shelves",
  "custom_shelf_books",
  "reading_lists",
  "reading_list_books",
  "reading_sessions",
  "reading_goals",
  "diary_entries",
  "vocabulary",
  "follows",
  "close_friends",
  "clubs",
  "club_members",
  "club_books",
  "club_threads",
  "club_posts",
  "club_polls",
  "club_poll_votes",
  "club_meetings",
  "club_meeting_rsvps",
  "club_schedule",
  "companion_threads",
  "companion_messages",
  "journal_posts",
  "journal_post_versions",
  "journal_slug_redirects",
  "journal_media",
  "journal_media_revisions",
  "announcements",
  "billing_events",
  "admin_audit_log",
] as const;

// Written by the operator alone (the catalog and its picks through the admin, the Journal and its
// pictures through Carrel), so the count read straight after the dump matches unless the dump lost
// rows. Reader-written tables, and any a cron inserts into, can change between the two reads, so
// they are left out. A run whose counted tables all dumped empty fails too: Foxing always has
// catalog books and Journal posts.
export const BACKUP_COUNTED_TABLES = [
  "books",
  "book_awards",
  "book_of_the_month",
  "external_book_clubs",
  "external_book_club_picks",
  "journal_posts",
  "journal_slug_redirects",
  "journal_media",
  "announcements",
] as const;
