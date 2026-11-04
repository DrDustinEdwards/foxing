-- site-api v0.21.0's addition to its own store (SITE_API_STORE_SQL_V0_21 from
-- @dustinedwards/site-api/store), written and read only through d1SiteApiStore, never through
-- Drizzle: each uploaded file's duplicate key (the SHA-256 of the bytes without their metadata)
-- and the media id it became, so a photo sent again is answered as a duplicate even when the
-- stored file differs from what was sent. Additive: one new table. No existing row is touched.
-- Apply with: wrangler d1 migrations apply foxing [--local|--remote]
CREATE TABLE IF NOT EXISTS media_uploads (sha256 TEXT PRIMARY KEY, media_id TEXT NOT NULL, at TEXT NOT NULL);
