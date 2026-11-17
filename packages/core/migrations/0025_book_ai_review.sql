CREATE TABLE `book_ai_review` (
	`book_id` text NOT NULL,
	`action` text NOT NULL,
	`verdict` text NOT NULL,
	`issues` text,
	`original` text,
	`sources` text,
	`searches` integer NOT NULL,
	`cost_micros` integer NOT NULL,
	`model` text NOT NULL,
	`checked_at` integer NOT NULL,
	PRIMARY KEY(`book_id`, `action`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
