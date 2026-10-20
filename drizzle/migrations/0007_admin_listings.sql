CREATE TABLE `listing_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text,
	`action` text NOT NULL,
	`changes` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `listing_changes_listing_idx` ON `listing_changes` (`listing_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `slug_redirects` (
	`old_slug` text PRIMARY KEY NOT NULL,
	`listing_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
