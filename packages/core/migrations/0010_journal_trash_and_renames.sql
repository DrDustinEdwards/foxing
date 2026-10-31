-- Carrel's site API v0.17.0 over the Journal: the old addresses of renamed posts (a 301 each), the
-- content trash's stamp on journal_posts, and a media file's focal point. Additive: one new table and
-- two nullable columns. No existing row is touched.
-- Apply with: wrangler d1 migrations apply foxing [--local|--remote]
CREATE TABLE `journal_slug_redirects` (
	`from_slug` text PRIMARY KEY NOT NULL,
	`to_slug` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `journal_posts` ADD `trashed_at` integer;--> statement-breakpoint
ALTER TABLE `journal_media` ADD `focus` text;
