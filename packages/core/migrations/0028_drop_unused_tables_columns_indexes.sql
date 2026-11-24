-- contract: the Foxing database audit of 2026-11-24, approved by Dustin as recommended. Nothing reads or writes any of these:
-- book_ai_review (folded into book_ai_cache by 0027), five empty tables with no code (saves, reports, badges, user_badges,
-- user_book_tags), user_favorites (empty, its profile strip removed), annotations_fts (written by three triggers, never
-- searched), columns no code touches, and six indexes that duplicate another one. Hand-run after the code that stops using
-- them is live: npx wrangler d1 migrations apply foxing --remote
DROP TABLE `book_ai_review`;--> statement-breakpoint
DROP TABLE `saves`;--> statement-breakpoint
DROP TABLE `reports`;--> statement-breakpoint
DROP TABLE `user_badges`;--> statement-breakpoint
DROP TABLE `badges`;--> statement-breakpoint
DROP TABLE `user_book_tags`;--> statement-breakpoint
DROP TABLE `user_favorites`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `annotations_fts_ai`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `annotations_fts_ad`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `annotations_fts_au`;--> statement-breakpoint
DROP TABLE `annotations_fts`;--> statement-breakpoint
DROP INDEX `books_author_slug_idx`;--> statement-breakpoint
DROP INDEX `user_books_user_idx`;--> statement-breakpoint
DROP INDEX `vocabulary_user_idx`;--> statement-breakpoint
DROP INDEX `reading_list_books_list_idx`;--> statement-breakpoint
DROP INDEX `companion_threads_user_book_idx`;--> statement-breakpoint
DROP INDEX `external_picks_club_id_idx`;--> statement-breakpoint
ALTER TABLE `books` DROP COLUMN `external_url`;--> statement-breakpoint
ALTER TABLE `books` DROP COLUMN `themes`;--> statement-breakpoint
ALTER TABLE `books` DROP COLUMN `reading_difficulty`;--> statement-breakpoint
ALTER TABLE `books` DROP COLUMN `country`;--> statement-breakpoint
ALTER TABLE `book_awards` DROP COLUMN `country`;--> statement-breakpoint
ALTER TABLE `user_books` DROP COLUMN `format_read`;--> statement-breakpoint
ALTER TABLE `reading_lists` DROP COLUMN `is_featured`;--> statement-breakpoint
ALTER TABLE `reading_streaks` DROP COLUMN `streak_freeze_credits`;--> statement-breakpoint
ALTER TABLE `reading_streaks` DROP COLUMN `total_books_finished`;--> statement-breakpoint
ALTER TABLE `reading_streaks` DROP COLUMN `total_highlights`;--> statement-breakpoint
ALTER TABLE `reading_streaks` DROP COLUMN `total_words_looked_up`;
