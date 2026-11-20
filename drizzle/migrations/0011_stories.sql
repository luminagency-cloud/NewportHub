CREATE TABLE `stories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`pull_quote` text,
	`interviewee` text,
	`series` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`owner_approved_at` integer,
	`published_at` integer,
	`source_interview_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stories_slug_unique` ON `stories` (`slug`);--> statement-breakpoint
CREATE INDEX `stories_listing_idx` ON `stories` (`listing_id`);--> statement-breakpoint
CREATE INDEX `stories_status_published_idx` ON `stories` (`status`,`published_at`);--> statement-breakpoint
ALTER TABLE `listings` ADD `social` text;