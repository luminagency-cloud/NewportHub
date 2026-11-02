CREATE TABLE `retired_slugs` (
	`slug` text PRIMARY KEY NOT NULL,
	`category_id` integer,
	`town_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE set null
);
