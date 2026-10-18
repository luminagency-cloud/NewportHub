CREATE TABLE `banner_ads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`image_r2_key` text NOT NULL,
	`link_url` text NOT NULL,
	`placement` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `banner_ads_placement_idx` ON `banner_ads` (`placement`,`active`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category_id` integer NOT NULL,
	`town_id` integer NOT NULL,
	`address` text,
	`phone` text,
	`website` text,
	`email` text,
	`description` text,
	`hours` text,
	`lat` real,
	`lng` real,
	`logo_r2_key` text,
	`tier` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`owner_user_id` text,
	`claimed_at` integer,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`source_place_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listings_slug_unique` ON `listings` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `listings_source_place_id_unique` ON `listings` (`source_place_id`);--> statement-breakpoint
CREATE INDEX `listings_status_tier_idx` ON `listings` (`status`,`tier`);--> statement-breakpoint
CREATE INDEX `listings_category_idx` ON `listings` (`category_id`);--> statement-breakpoint
CREATE INDEX `listings_town_idx` ON `listings` (`town_id`);--> statement-breakpoint
CREATE TABLE `towns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`state` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `towns_slug_unique` ON `towns` (`slug`);