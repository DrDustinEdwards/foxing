CREATE TABLE `auth_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`event` text NOT NULL,
	`change` text,
	`via` text,
	`user_id` text,
	`device` text,
	`location` text
);
--> statement-breakpoint
CREATE INDEX `auth_events_user` ON `auth_events` (`user_id`,`at`);--> statement-breakpoint
CREATE INDEX `auth_events_at` ON `auth_events` (`at`,`event`);