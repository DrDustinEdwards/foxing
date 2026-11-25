// What the nightly dump must leave out, carry and count (d1-dump's runCheckedBackup checks them).
// EXCLUDED because a backup copy is one more place a credential could leak from, and restoring one revives it:
// session (bearer tokens), verification (one-time values), account (Google/Apple links; recreated at next sign-in),
// push_tokens (anyone holding one can push; the app registers again), preview_links (a restore would bring back a
// revoked link). Passkeys are KEPT: public keys only, and readers would otherwise add theirs again.
// FTS5 tables are not excluded: d1-dump skips shadow tables and dumps these through their columns with rowid.
// d1-dump fails the night on a dumped column named for a credential (allow it below with a reason) and on an excluded
// name that is not a table, so a table dropped by a migration leaves this list too.
export const BACKUP_EXCLUDE = [
  "session",
  "verification",
  "account",
  "push_tokens",
  "preview_links",
] as const;

export const BACKUP_CREDENTIAL_ALLOW: Record<string, string> = {
  "passkey.credential_id": "a passkey's public credential id; the table holds only public keys",
};

// Everything that exists nowhere else, so each must be in the dump.
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
  "media",
  "media_revisions",
  "announcements",
  "billing_events",
  "admin_audit_log",
] as const;

// Written by the operator alone, so the count read after the dump matches unless it lost rows; reader-written tables
// and cron-inserted ones change between the reads and are left out. A run whose counted tables all dumped empty fails too.
export const BACKUP_COUNTED_TABLES = [
  "books",
  "book_awards",
  "book_of_the_month",
  "external_book_clubs",
  "external_book_club_picks",
  "journal_posts",
  "journal_slug_redirects",
  "media",
  "announcements",
] as const;
