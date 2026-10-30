-- The Journal's media library (site-api's media group, for Carrel): the index of the pictures
-- uploaded for Journal posts, their byte history, and the change log a library screen polls.
-- Additive: three new tables, their indexes and three triggers. No existing row is touched.
-- Book covers are not part of it. Apply with: wrangler d1 migrations apply foxing [--local|--remote]
CREATE TABLE `journal_media` (
	`key` text PRIMARY KEY NOT NULL,
	`rev` integer DEFAULT 0 NOT NULL,
	`filename` text,
	`content_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`sha256` text NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`credit` text DEFAULT '' NOT NULL,
	`license` text DEFAULT '' NOT NULL,
	`source_url` text,
	`license_expires` text,
	`taken_at` text,
	`uploaded_at` integer NOT NULL,
	`trashed_at` integer
);
--> statement-breakpoint
CREATE INDEX `journal_media_sha256_idx` ON `journal_media` (`sha256`);--> statement-breakpoint
CREATE TABLE `journal_media_changes` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_key` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `journal_media_changes_key_idx` ON `journal_media_changes` (`media_key`,`seq`);--> statement-breakpoint
CREATE TABLE `journal_media_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_key` text NOT NULL,
	`at` integer NOT NULL,
	`bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`reason` text NOT NULL,
	`sha256` text,
	`backup_key` text
);
--> statement-breakpoint
CREATE INDEX `journal_media_revisions_key_idx` ON `journal_media_revisions` (`media_key`,`id`);
--> statement-breakpoint
-- Every change to a file's row, in order: what a library's changedSince answers from. Triggers,
-- so no writer can change a row without the log seeing it.
CREATE TRIGGER `journal_media_changes_ai` AFTER INSERT ON `journal_media` BEGIN
  INSERT INTO `journal_media_changes` (`media_key`) VALUES (NEW.`key`);
END;
--> statement-breakpoint
CREATE TRIGGER `journal_media_changes_au` AFTER UPDATE ON `journal_media` BEGIN
  INSERT INTO `journal_media_changes` (`media_key`) VALUES (NEW.`key`);
END;
--> statement-breakpoint
CREATE TRIGGER `journal_media_changes_ad` AFTER DELETE ON `journal_media` BEGIN
  INSERT INTO `journal_media_changes` (`media_key`) VALUES (OLD.`key`);
END;
