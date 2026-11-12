// The media library's tables (3): the pictures Carrel uploads for Journal posts, their byte
// history and the change log a library screen polls. They are site-api's standard tables
// (MEDIA_LIBRARY_SQL, migration 0023), written only by site-api's d1MediaStore through Carrel's
// site API with the site key (apps/web/app/lib/carrel). Described here so the Journal's reads can
// join them and drizzle-kit keeps them. Readers never upload here (Capsid foxing/do-not-build.md).
// Book covers are not in it: they stay books.cover_url on covers.foxing.app.
//
// The bytes live in the MEDIA R2 bucket under journal/; each earlier set of bytes is copied to
// the private BACKUPS bucket under journal-media/ before it is overwritten (copy_key).
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { json } from "./_helpers";

export const media = sqliteTable(
  "media",
  {
    /** The R2 key and the media id, such as journal/2026/10/reading-room-1a2b3c4d.webp. */
    key: text("key").primaryKey(),
    filename: text("filename"),
    contentType: text("content_type").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    /** SHA-256 of the current bytes, lower case hex. */
    sha256: text("sha256").notNull(),
    alt: text("alt").notNull().default(""),
    caption: text("caption").notNull().default(""),
    tags: json<string[]>("tags").notNull().default([]),
    /** The focal point, "XxY" from the top left; a cropped cover keeps it in view. */
    focus: text("focus"),
    credit: text("credit").notNull().default(""),
    license: text("license").notNull().default(""),
    sourceUrl: text("source_url"),
    licenseExpires: text("license_expires"),
    takenAt: text("taken_at"),
    /** ISO 8601 UTC. */
    uploadedAt: text("uploaded_at").notNull(),
    trashedAt: text("trashed_at"),
    rev: integer("rev").notNull().default(0),
    placeholder: text("placeholder"),
    color: text("color"),
  },
  (t) => [index("media_sha256").on(t.sha256)],
);

export const mediaRevisions = sqliteTable(
  "media_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mediaKey: text("media_key").notNull(),
    at: text("at").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    reason: text("reason").notNull(),
    sha256: text("sha256").notNull(),
    copyKey: text("copy_key"),
  },
  (t) => [index("media_revisions_key").on(t.mediaKey, t.id)],
);

/** Every insert, update and delete of a media row, in order (triggers in the migration). */
export const mediaChanges = sqliteTable("media_changes", {
  seq: integer("seq").primaryKey({ autoIncrement: true }),
  mediaKey: text("media_key").notNull(),
});
