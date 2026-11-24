ALTER TABLE `book_ai_cache` ADD `verdict` text;--> statement-breakpoint
ALTER TABLE `book_ai_cache` ADD `issues` text;--> statement-breakpoint
ALTER TABLE `book_ai_cache` ADD `original` text;--> statement-breakpoint
ALTER TABLE `book_ai_cache` ADD `cost_micros` integer;--> statement-breakpoint
ALTER TABLE `book_ai_cache` ADD `checked_at` integer;--> statement-breakpoint
CREATE INDEX `notifications_created_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE INDEX `close_friends_friend_idx` ON `close_friends` (`friend_id`);--> statement-breakpoint
CREATE INDEX `user_books_book_idx` ON `user_books` (`book_id`);
