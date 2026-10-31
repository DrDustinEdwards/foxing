-- site-api's own store (SITE_API_STORE_SQL from @dustinedwards/site-api/store, v0.17.0), written and
-- read only through its d1SiteApiStore (apps/web/app/lib/carrel/site-api.server.ts), never through
-- Drizzle (src/schema): each Carrel write's answer under its change id for 7 days (site_api_writes),
-- so a retry answers the same and runs nothing; the publish hooks that failed, for the cron to run
-- again (hook_retries); only the SHA-256 of each preview link's token (preview_links); and the pages
-- each post last sent webmentions to (webmention_targets). Then SCHEDULED_UPDATES_SQL from
-- @dustinedwards/site-api/schedules, read and written only through its d1ScheduledUpdates
-- (apps/web/app/lib/carrel/journal-adapter.server.ts): the schedule waiting on each Journal post
-- (scheduled_updates), a draft's time to go live or a live post's update. Times are UTC ISO text.
-- Additive: five new tables and four indexes. No existing row is touched.
-- Apply with: wrangler d1 migrations apply foxing [--local|--remote]
CREATE TABLE IF NOT EXISTS site_api_writes (
  change_id TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status INTEGER,
  response TEXT,
  state TEXT NOT NULL,
  at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS site_api_writes_at ON site_api_writes (at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS hook_retries (
  id TEXT PRIMARY KEY,
  hook TEXT NOT NULL,
  event TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  next_at TEXT NOT NULL,
  last_error TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hook_retries_due ON hook_retries (next_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS preview_links (
  token_hash TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  change_id TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS preview_links_content ON preview_links (content_id, expires_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS webmention_targets (
  source TEXT PRIMARY KEY,
  targets TEXT NOT NULL,
  sent_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS scheduled_updates (
  content_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  publish_at TEXT NOT NULL,
  change_id TEXT NOT NULL,
  scheduled_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS scheduled_updates_due ON scheduled_updates (publish_at);
