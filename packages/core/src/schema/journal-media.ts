// The Journal's media library (3 tables): the pictures Carrel uploads for Journal posts, their
// byte history and the change log a library screen polls. Editorial only: every row is written
// through Carrel's site API with the site key (apps/web/app/lib/carrel). Readers never upload
// here, and posts by readers carry no images (Capsid foxing/do-not-build.md). Book covers are
// not in it: they stay books.cover_url on covers.foxing.app, untouched by this library.
//
// The bytes live in the MEDIA R2 bucket under journal/; each earlier set of bytes is copied to
// the private BACKUPS bucket under journal-media/ before it is overwritten (backup_key).
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { json, ts } from "./_helpers";

export const journalMedia = sqliteTable(
  "journal_media",
  {
    /** The R2 key and the media id, such as journal/2026/10/reading-room-1a2b3c4d.webp. */
    key: text("key").primaryKey(),
    /** Moves on every write to the row, checked in the same statement (the media version). */
    rev: integer("rev").notNull().default(0),
    /** The name it was uploaded with. */
    filename: text("filename"),
    contentType: text("content_type").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    /** SHA-256 of the current bytes, lower case hex: duplicates are exact bytes. */
    sha256: text("sha256").notNull(),
    /** site-api's MediaPlaceholder: a 16 pixel blurred WebP data: URI; null where none was made. */
    placeholder: text("placeholder"),
    /** The picture's main color, #rrggbb; null where none was read. */
    color: text("color"),
    alt: text("alt").notNull().default(""),
    caption: text("caption").notNull().default(""),
    tags: json<string[]>("tags").notNull().default([]),
    credit: text("credit").notNull().default(""),
    license: text("license").notNull().default(""),
    sourceUrl: text("source_url"),
    /** YYYY-MM-DD; null for a license with no end. */
    licenseExpires: text("license_expires"),
    /** As the picture's own metadata says: with an offset where it names one. */
    takenAt: text("taken_at"),
    uploadedAt: ts("uploaded_at").notNull(),
    /** The focal point, "XxY" from the top left (site-api's MediaFocus); a cropped cover keeps it in view. */
    focus: text("focus"),
    /** In the trash since; null in the library. A trashed file is still served. */
    trashedAt: ts("trashed_at"),
  },
  (t) => [index("journal_media_sha256_idx").on(t.sha256)],
);

/** One row per set of bytes a file has had; the newest for a key is its current bytes. */
export const journalMediaRevisions = sqliteTable(
  "journal_media_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mediaKey: text("media_key").notNull(),
    at: ts("at").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    /** upload | import | replace | transform | resize | revert */
    reason: text("reason").notNull(),
    sha256: text("sha256"),
    /** Where BACKUPS keeps these bytes once newer ones replaced them; null for the current ones. */
    backupKey: text("backup_key"),
  },
  (t) => [index("journal_media_revisions_key_idx").on(t.mediaKey, t.id)],
);

/** Every insert, update and delete of a journal_media row, in order (triggers in the migration). */
export const journalMediaChanges = sqliteTable(
  "journal_media_changes",
  {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    mediaKey: text("media_key").notNull(),
  },
  (t) => [index("journal_media_changes_key_idx").on(t.mediaKey, t.seq)],
);
