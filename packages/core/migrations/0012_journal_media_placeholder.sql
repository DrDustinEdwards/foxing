-- prepareUpload's placeholder and main color on each Journal picture, shown by Carrel's media library.
-- Additive: two nullable columns; files stored before stay null until their bytes change.
-- Apply with: wrangler d1 migrations apply foxing [--local|--remote]
ALTER TABLE `journal_media` ADD `placeholder` text;--> statement-breakpoint
ALTER TABLE `journal_media` ADD `color` text;