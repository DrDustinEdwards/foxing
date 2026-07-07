CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `book_ai_cache` (
	`book_id` text NOT NULL,
	`action` text NOT NULL,
	`content` text NOT NULL,
	`model` text,
	`generated_at` integer NOT NULL,
	PRIMARY KEY(`book_id`, `action`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `book_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`award_slug` text NOT NULL,
	`award_name` text NOT NULL,
	`year` integer,
	`distinction` text NOT NULL,
	`scope` text NOT NULL,
	`country` text,
	`url` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_awards_book_id_idx` ON `book_awards` (`book_id`);--> statement-breakpoint
CREATE TABLE `book_of_the_month` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`category` text,
	`curator_note` text,
	`amazon_url` text,
	`bookshop_url` text,
	`is_published` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`gutenberg_id` integer,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`author_slug` text,
	`slug` text NOT NULL,
	`description` text,
	`cover_url` text,
	`epub_url` text,
	`source` text NOT NULL,
	`source_type` text NOT NULL,
	`external_url` text,
	`language` text NOT NULL,
	`subjects` text,
	`themes` text,
	`mood_tags` text,
	`content_warnings` text,
	`pacing` text,
	`reading_difficulty` real,
	`word_count` integer,
	`publication_year` integer,
	`publisher` text,
	`country` text,
	`series_name` text,
	`series_order` real,
	`isbn` text,
	`isbn13` text,
	`amazon_url` text,
	`bookshop_url` text,
	`is_staff_pick` integer DEFAULT false NOT NULL,
	`staff_pick_note` text,
	`weighted_rating` real,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`added_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`added_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_slug_unique` ON `books` (`slug`);--> statement-breakpoint
CREATE INDEX `books_author_slug_idx` ON `books` (`author_slug`);--> statement-breakpoint
CREATE INDEX `books_source_type_idx` ON `books` (`source_type`);--> statement-breakpoint
CREATE INDEX `books_isbn13_idx` ON `books` (`isbn13`);--> statement-breakpoint
CREATE TABLE `external_book_club_picks` (
	`id` text PRIMARY KEY NOT NULL,
	`club_id` text NOT NULL,
	`book_id` text,
	`picked_at` integer,
	`pick_month` integer,
	`pick_year` integer,
	`category` text,
	`official_url` text,
	`notes` text,
	`curator_quote` text,
	`era_label` text,
	`era_start_year` integer,
	`era_end_year` integer,
	`auto_source` text,
	`auto_confidence` real,
	`is_auto_discovered` integer DEFAULT false NOT NULL,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `external_book_clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `external_picks_club_id_idx` ON `external_book_club_picks` (`club_id`);--> statement-breakpoint
CREATE TABLE `external_book_clubs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`description` text,
	`curator` text,
	`website_url` text,
	`logo_url` text,
	`cadence` text,
	`focus` text,
	`eras` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_book_clubs_slug_unique` ON `external_book_clubs` (`slug`);--> statement-breakpoint
CREATE TABLE `journal_post_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`excerpt` text,
	`saved_at` integer NOT NULL,
	`saved_by` text,
	FOREIGN KEY (`post_id`) REFERENCES `journal_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`saved_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `journal_post_versions_post_id_idx` ON `journal_post_versions` (`post_id`);--> statement-breakpoint
CREATE TABLE `journal_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`content` text NOT NULL,
	`excerpt` text,
	`cover_image_url` text,
	`cover_image_alt` text,
	`author_id` text,
	`tags` text,
	`related_post_ids` text,
	`featured` integer DEFAULT false NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`published_at` integer,
	`show_published_at` integer DEFAULT true NOT NULL,
	`show_updated_at` integer DEFAULT true NOT NULL,
	`og_title` text,
	`og_description` text,
	`canonical_url` text,
	`reading_time_minutes` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journal_posts_slug_unique` ON `journal_posts` (`slug`);--> statement-breakpoint
CREATE INDEX `journal_posts_published_idx` ON `journal_posts` (`is_published`,`published_at`);--> statement-breakpoint
CREATE TABLE `badges` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`category` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `badges_slug_unique` ON `badges` (`slug`);--> statement-breakpoint
CREATE TABLE `custom_shelf_books` (
	`shelf_id` text NOT NULL,
	`book_id` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`shelf_id`, `book_id`),
	FOREIGN KEY (`shelf_id`) REFERENCES `custom_shelves`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `custom_shelves` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_public` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `custom_shelves_user_idx` ON `custom_shelves` (`user_id`);--> statement-breakpoint
CREATE TABLE `diary_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`log_date` integer NOT NULL,
	`rating_half` integer,
	`review` text,
	`contains_spoilers` integer DEFAULT false NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`slug` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `diary_user_book_idx` ON `diary_entries` (`user_id`,`book_id`);--> statement-breakpoint
CREATE INDEX `diary_updated_idx` ON `diary_entries` (`updated_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`backdrop_url` text,
	`bio` text,
	`custom_url` text,
	`favorite_genres` text,
	`language_preference` text,
	`theme_preference` text,
	`subscription_tier` text DEFAULT 'free' NOT NULL,
	`visibility` text,
	`notification_prefs` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`is_suspended` integer DEFAULT false NOT NULL,
	`timezone` text,
	`onboarded_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_username_unique` ON `profiles` (`username`);--> statement-breakpoint
CREATE TABLE `reading_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`target` integer NOT NULL,
	`period_type` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer,
	`week` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goals_user_idx` ON `reading_goals` (`user_id`);--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`pages_read` integer DEFAULT 0 NOT NULL,
	`avg_wpm` real,
	`last_wpm` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_book_idx` ON `reading_sessions` (`user_id`,`book_id`);--> statement-breakpoint
CREATE TABLE `reading_streaks` (
	`user_id` text PRIMARY KEY NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_read_date` integer,
	`streak_freeze_credits` integer DEFAULT 0 NOT NULL,
	`total_books_finished` integer DEFAULT 0 NOT NULL,
	`total_pages_read` integer DEFAULT 0 NOT NULL,
	`total_highlights` integer DEFAULT 0 NOT NULL,
	`total_words_looked_up` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_badges` (
	`user_id` text NOT NULL,
	`badge_id` text NOT NULL,
	`earned_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `badge_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_book_tags` (
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`user_id`, `book_id`, `tag`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_books` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`status` text NOT NULL,
	`progress` text,
	`progress_pct` real DEFAULT 0 NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`paused_at` integer,
	`paused_note` text,
	`abandoned_at` integer,
	`format_read` text,
	`mood_tags` text,
	`personal_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_books_user_idx` ON `user_books` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_books_updated_idx` ON `user_books` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_books_user_book_uq` ON `user_books` (`user_id`,`book_id`);--> statement-breakpoint
CREATE TABLE `user_favorites` (
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `book_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vocabulary` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text,
	`word` text NOT NULL,
	`definition` text NOT NULL,
	`context_sentence` text,
	`ai_context` text,
	`mastered` integer DEFAULT false NOT NULL,
	`looked_up_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `vocabulary_user_idx` ON `vocabulary` (`user_id`);--> statement-breakpoint
CREATE TABLE `annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text,
	`club_id` text,
	`type` text NOT NULL,
	`locator` text,
	`selected_text` text,
	`normalized_text` text,
	`body` text,
	`color` text,
	`chapter` text,
	`source_title` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`contains_spoilers` integer DEFAULT false NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`parent_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `annotations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `annotations_user_book_idx` ON `annotations` (`user_id`,`book_id`);--> statement-breakpoint
CREATE INDEX `annotations_popular_idx` ON `annotations` (`book_id`,`type`,`visibility`,`normalized_text`);--> statement-breakpoint
CREATE INDEX `annotations_club_book_idx` ON `annotations` (`club_id`,`book_id`);--> statement-breakpoint
CREATE INDEX `annotations_parent_idx` ON `annotations` (`parent_id`);--> statement-breakpoint
CREATE INDEX `annotations_updated_idx` ON `annotations` (`updated_at`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `target_type`, `target_id`, `kind`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reactions_target_idx` ON `reactions` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `saves` (
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `target_type`, `target_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `club_books` (
	`id` text PRIMARY KEY NOT NULL,
	`club_id` text NOT NULL,
	`book_id` text NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`is_current` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `club_books_club_idx` ON `club_books` (`club_id`);--> statement-breakpoint
CREATE TABLE `club_meeting_rsvps` (
	`meeting_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`meeting_id`, `user_id`),
	FOREIGN KEY (`meeting_id`) REFERENCES `club_meetings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `club_meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`club_id` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`book_id` text,
	`meeting_date` integer NOT NULL,
	`end_date` integer,
	`meeting_type` text DEFAULT 'virtual' NOT NULL,
	`location_name` text,
	`location_address` text,
	`location_url` text,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurrence_rule` text,
	`rsvp_limit` integer,
	`is_cancelled` integer DEFAULT false NOT NULL,
	`cancelled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `club_meetings_club_idx` ON `club_meetings` (`club_id`);--> statement-breakpoint
CREATE TABLE `club_members` (
	`club_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer,
	`invited_by` text,
	`requested_at` integer,
	`banned_at` integer,
	`banned_by` text,
	`ban_reason` text,
	`muted_until` integer,
	`muted_by` text,
	PRIMARY KEY(`club_id`, `user_id`),
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`banned_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`muted_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `club_members_user_idx` ON `club_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `club_poll_votes` (
	`poll_id` text NOT NULL,
	`user_id` text NOT NULL,
	`ranks` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`poll_id`, `user_id`),
	FOREIGN KEY (`poll_id`) REFERENCES `club_polls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `club_polls` (
	`id` text PRIMARY KEY NOT NULL,
	`club_id` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`poll_type` text DEFAULT 'single' NOT NULL,
	`options` text NOT NULL,
	`closes_at` integer,
	`is_closed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `club_polls_club_idx` ON `club_polls` (`club_id`);--> statement-breakpoint
CREATE TABLE `club_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`parent_post_id` text,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`has_spoiler` integer DEFAULT false NOT NULL,
	`is_edited` integer DEFAULT false NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`is_removed` integer DEFAULT false NOT NULL,
	`removed_at` integer,
	`removed_by` text,
	`removed_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `club_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_post_id`) REFERENCES `club_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`removed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `club_posts_thread_idx` ON `club_posts` (`thread_id`);--> statement-breakpoint
CREATE TABLE `club_schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`club_id` text NOT NULL,
	`chapter_name` text NOT NULL,
	`unlock_date` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `club_schedule_club_idx` ON `club_schedule` (`club_id`);--> statement-breakpoint
CREATE TABLE `club_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`club_id` text NOT NULL,
	`book_id` text,
	`author_id` text NOT NULL,
	`type` text DEFAULT 'discussion' NOT NULL,
	`title` text NOT NULL,
	`chapter` text,
	`is_pinned` integer DEFAULT false NOT NULL,
	`is_ai_starter` integer DEFAULT false NOT NULL,
	`has_spoilers` integer DEFAULT false NOT NULL,
	`expires_at` integer,
	`is_removed` integer DEFAULT false NOT NULL,
	`removed_by` text,
	`removed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`removed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `club_threads_club_idx` ON `club_threads` (`club_id`);--> statement-breakpoint
CREATE TABLE `clubs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text,
	`description` text,
	`cover_url` text,
	`creator_id` text NOT NULL,
	`current_book_id` text,
	`club_type` text DEFAULT 'reader' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`member_approval` integer DEFAULT false NOT NULL,
	`max_members` integer,
	`reading_pace` text,
	`chapters_per_week` integer,
	`genre_tags` text,
	`join_code` text,
	`bookstore` text,
	`is_verified` integer DEFAULT false NOT NULL,
	`verified_at` integer,
	`verified_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`current_book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`verified_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clubs_slug_unique` ON `clubs` (`slug`);--> statement-breakpoint
CREATE INDEX `clubs_creator_idx` ON `clubs` (`creator_id`);--> statement-breakpoint
CREATE INDEX `clubs_join_code_idx` ON `clubs` (`join_code`);--> statement-breakpoint
CREATE TABLE `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`book_id` text,
	`target_id` text,
	`data` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activity_user_idx` ON `activity_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `activity_created_idx` ON `activity_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `close_friends` (
	`user_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `friend_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`follower_id`, `following_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follows_following_idx` ON `follows` (`following_id`);--> statement-breakpoint
CREATE TABLE `reading_list_books` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`book_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`note` text,
	`added_at` integer,
	FOREIGN KEY (`list_id`) REFERENCES `reading_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reading_list_books_list_idx` ON `reading_list_books` (`list_id`);--> statement-breakpoint
CREATE TABLE `reading_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text,
	`description` text,
	`cover_url` text,
	`is_public` integer DEFAULT false NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reading_lists_user_idx` ON `reading_lists` (`user_id`);--> statement-breakpoint
CREATE TABLE `admin_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`params` text,
	`actor` text,
	`source_ip` text,
	`performed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`data` text,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`is_read`);--> statement-breakpoint
CREATE TABLE `push_tokens` (
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`platform` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer,
	PRIMARY KEY(`user_id`, `token`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reports_status_idx` ON `reports` (`status`);--> statement-breakpoint
CREATE TABLE `companion_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`action` text,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `companion_threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `companion_messages_thread_idx` ON `companion_messages` (`thread_id`);--> statement-breakpoint
CREATE TABLE `companion_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`mode` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `companion_threads_user_book_idx` ON `companion_threads` (`user_id`,`book_id`);
--> statement-breakpoint
CREATE VIRTUAL TABLE books_fts USING fts5(title, author, subjects_flat, book_id UNINDEXED, source_type UNINDEXED, tokenize = 'trigram');
--> statement-breakpoint
CREATE TRIGGER books_fts_ai AFTER INSERT ON books BEGIN
  INSERT INTO books_fts(rowid, title, author, subjects_flat, book_id, source_type)
  VALUES (new.rowid, new.title, new.author, (SELECT coalesce(group_concat(je.value, ' '), '') FROM json_each(coalesce(new.subjects, '[]')) je), new.id, new.source_type);
END;
--> statement-breakpoint
CREATE TRIGGER books_fts_ad AFTER DELETE ON books BEGIN
  DELETE FROM books_fts WHERE rowid = old.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER books_fts_au AFTER UPDATE ON books BEGIN
  DELETE FROM books_fts WHERE rowid = old.rowid;
  INSERT INTO books_fts(rowid, title, author, subjects_flat, book_id, source_type)
  VALUES (new.rowid, new.title, new.author, (SELECT coalesce(group_concat(je.value, ' '), '') FROM json_each(coalesce(new.subjects, '[]')) je), new.id, new.source_type);
END;
--> statement-breakpoint
CREATE VIRTUAL TABLE annotations_fts USING fts5(selected_text, body, annotation_id UNINDEXED, user_id UNINDEXED, visibility UNINDEXED, tokenize = 'trigram');
--> statement-breakpoint
CREATE TRIGGER annotations_fts_ai AFTER INSERT ON annotations BEGIN
  INSERT INTO annotations_fts(rowid, selected_text, body, annotation_id, user_id, visibility)
  VALUES (new.rowid, new.selected_text, new.body, new.id, new.user_id, new.visibility);
END;
--> statement-breakpoint
CREATE TRIGGER annotations_fts_ad AFTER DELETE ON annotations BEGIN
  DELETE FROM annotations_fts WHERE rowid = old.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER annotations_fts_au AFTER UPDATE ON annotations BEGIN
  DELETE FROM annotations_fts WHERE rowid = old.rowid;
  INSERT INTO annotations_fts(rowid, selected_text, body, annotation_id, user_id, visibility)
  VALUES (new.rowid, new.selected_text, new.body, new.id, new.user_id, new.visibility);
END;
