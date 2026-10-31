ALTER TABLE `journal_post_versions` ADD `fields` text;--> statement-breakpoint
ALTER TABLE `journal_post_versions` ADD `author_id` text REFERENCES user(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `journal_post_versions` ADD `event` text;--> statement-breakpoint
ALTER TABLE `journal_posts` ADD `series` text;--> statement-breakpoint
ALTER TABLE `journal_posts` ADD `series_part` integer;