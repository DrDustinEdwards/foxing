CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`placement` text DEFAULT 'banner' NOT NULL,
	`link_url` text,
	`link_label` text,
	`is_active` integer DEFAULT false NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `announcements_active_idx` ON `announcements` (`is_active`,`placement`);