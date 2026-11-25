// The media library's tables: site-api's standard tables (MEDIA_LIBRARY_SQL), written only by site-api's d1MediaStore through Carrel's site
// API; described here so the Journal's reads can join them and drizzle-kit keeps them. Readers never upload here. Book covers are not in it
// (books.cover_url on covers.foxing.app). Bytes live in the MEDIA R2 bucket under journal/; each earlier set is copied to the private BACKUPS
// bucket under journal-media/ before being overwritten (copy_key).
export { media, mediaChanges, mediaRevisions } from "@dustinedwards/site-api/drizzle";
