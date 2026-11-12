// The media library's tables (3): the pictures Carrel uploads for Journal posts, their byte
// history and the change log a library screen polls. They are site-api's standard tables
// (MEDIA_LIBRARY_SQL, migration 0023), written only by site-api's d1MediaStore through Carrel's
// site API with the site key (apps/web/app/lib/carrel). Described here so the Journal's reads can
// join them and drizzle-kit keeps them. Readers never upload here (Capsid foxing/do-not-build.md).
// Book covers are not in it: they stay books.cover_url on covers.foxing.app.
//
// The bytes live in the MEDIA R2 bucket under journal/; each earlier set of bytes is copied to
// the private BACKUPS bucket under journal-media/ before it is overwritten (copy_key).
// The Drizzle tables are site-api's own (./drizzle, held to that SQL in its test).
export { media, mediaChanges, mediaRevisions } from "@dustinedwards/site-api/drizzle";
