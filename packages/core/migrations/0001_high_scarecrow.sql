CREATE TABLE `billing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `subscription_status` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `subscription_period_end` integer;