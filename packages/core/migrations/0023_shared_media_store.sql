-- site-api's standard media tables (MEDIA_LIBRARY_SQL), which its d1MediaStore writes in place of
-- Foxing's own store over journal_media. Additive: three new tables, two indexes, three triggers,
-- and a copy of every journal_media row. Times become ISO 8601 UTC (the old columns are epoch ms).
-- The change log is copied first with its sequence numbers, so a cursor Carrel holds still means
-- the same place; the copied rows then log once more, after it. journal_media* are dropped by
-- 0024 once this release is live.
-- Apply with: wrangler d1 migrations apply foxing [--local|--remote]
CREATE TABLE `media` (
	`key` text PRIMARY KEY NOT NULL,
	`filename` text,
	`content_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`sha256` text NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`focus` text,
	`credit` text DEFAULT '' NOT NULL,
	`license` text DEFAULT '' NOT NULL,
	`source_url` text,
	`license_expires` text,
	`taken_at` text,
	`uploaded_at` text NOT NULL,
	`trashed_at` text,
	`rev` integer DEFAULT 0 NOT NULL,
	`placeholder` text,
	`color` text
);
--> statement-breakpoint
CREATE INDEX `media_sha256` ON `media` (`sha256`);--> statement-breakpoint
CREATE TABLE `media_changes` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_key` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_key` text NOT NULL,
	`at` text NOT NULL,
	`bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`reason` text NOT NULL,
	`sha256` text NOT NULL,
	`copy_key` text
);
--> statement-breakpoint
CREATE INDEX `media_revisions_key` ON `media_revisions` (`media_key`,`id`);--> statement-breakpoint
CREATE TRIGGER media_changes_insert AFTER INSERT ON media BEGIN
  INSERT INTO media_changes (media_key) VALUES (NEW.key);
END;
--> statement-breakpoint
CREATE TRIGGER media_changes_update AFTER UPDATE ON media BEGIN
  INSERT INTO media_changes (media_key) VALUES (NEW.key);
END;
--> statement-breakpoint
CREATE TRIGGER media_changes_delete AFTER DELETE ON media BEGIN
  INSERT INTO media_changes (media_key) VALUES (OLD.key);
END;
--> statement-breakpoint
INSERT INTO `media_changes` (`seq`, `media_key`) SELECT `seq`, `media_key` FROM `journal_media_changes` ORDER BY `seq`;
--> statement-breakpoint
INSERT INTO `media_revisions` (`id`, `media_key`, `at`, `bytes`, `width`, `height`, `reason`, `sha256`, `copy_key`)
SELECT `id`, `media_key`,
  strftime('%Y-%m-%dT%H:%M:%S', `at` / 1000, 'unixepoch') || '.' || printf('%03d', `at` % 1000) || 'Z',
  `bytes`, `width`, `height`, `reason`, coalesce(`sha256`, ''), `backup_key`
FROM `journal_media_revisions` ORDER BY `id`;
--> statement-breakpoint
INSERT INTO `media` (`key`, `filename`, `content_type`, `bytes`, `width`, `height`, `sha256`, `alt`, `caption`, `tags`, `focus`, `credit`, `license`, `source_url`, `license_expires`, `taken_at`, `uploaded_at`, `trashed_at`, `rev`, `placeholder`, `color`)
SELECT `key`, `filename`, `content_type`, `bytes`, `width`, `height`, `sha256`, `alt`, `caption`, `tags`, `focus`, `credit`, `license`, `source_url`, `license_expires`, `taken_at`,
  strftime('%Y-%m-%dT%H:%M:%S', `uploaded_at` / 1000, 'unixepoch') || '.' || printf('%03d', `uploaded_at` % 1000) || 'Z',
  CASE WHEN `trashed_at` IS NULL THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%S', `trashed_at` / 1000, 'unixepoch') || '.' || printf('%03d', `trashed_at` % 1000) || 'Z' END,
  `rev`, `placeholder`, `color`
FROM `journal_media` ORDER BY `uploaded_at`, `key`;
