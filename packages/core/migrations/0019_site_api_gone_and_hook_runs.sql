-- site-api v0.22.0's addition to its own store (SITE_API_STORE_SQL_V0_22 from
-- @dustinedwards/site-api/store), written and read only through d1SiteApiStore, never through
-- Drizzle: gone_paths keeps the address of a deleted page so it answers 410, and hook_runs keeps
-- each publish hook's run for GET /hooks/recent. Additive: two new tables and their indexes.
-- No existing row is touched.
-- Apply with: wrangler d1 migrations apply foxing [--local|--remote]
CREATE TABLE IF NOT EXISTS gone_paths (path TEXT PRIMARY KEY, gone_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hook_runs (change_id TEXT NOT NULL, hook TEXT NOT NULL, ok INTEGER NOT NULL, at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS hook_runs_change ON hook_runs (change_id);
CREATE INDEX IF NOT EXISTS hook_runs_at ON hook_runs (at);
