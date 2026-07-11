ALTER TABLE `vocabulary` ADD `updated_at` integer;--> statement-breakpoint
CREATE INDEX `vocabulary_updated_idx` ON `vocabulary` (`user_id`,`updated_at`);