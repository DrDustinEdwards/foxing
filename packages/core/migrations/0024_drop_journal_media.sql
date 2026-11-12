-- contract: journal_media, its revisions and its change log are unused since 0023 moved the Journal's media library
-- onto site-api's standard tables (media, media_revisions, media_changes) and #381 switched the code. They held 0
-- rows in production when 0023 copied them. Hand-run: npx wrangler d1 migrations apply foxing --remote
DROP TRIGGER IF EXISTS `journal_media_changes_ai`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `journal_media_changes_au`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `journal_media_changes_ad`;--> statement-breakpoint
DROP TABLE `journal_media_changes`;--> statement-breakpoint
DROP TABLE `journal_media_revisions`;--> statement-breakpoint
DROP TABLE `journal_media`;
