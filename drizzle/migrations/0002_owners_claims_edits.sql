-- Hand-edited after drizzle-kit generate: the generated rebuild selected the new suggested_*
-- columns from the old table, and created claims/pending_edits before rebuilding their parent.
-- D1 enforces foreign keys, so defer the checks to commit instead of PRAGMA foreign_keys=OFF.
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category_id` integer,
	`town_id` integer,
	`suggested_category` text,
	`suggested_town` text,
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
INSERT INTO `__new_listings`("id", "slug", "name", "category_id", "town_id", "suggested_category", "suggested_town", "address", "phone", "website", "email", "description", "hours", "lat", "lng", "logo_r2_key", "tier", "status", "owner_user_id", "claimed_at", "stripe_customer_id", "stripe_subscription_id", "source_place_id", "created_at", "updated_at") SELECT "id", "slug", "name", "category_id", "town_id", NULL, NULL, "address", "phone", "website", "email", "description", "hours", "lat", "lng", "logo_r2_key", "tier", "status", "owner_user_id", "claimed_at", "stripe_customer_id", "stripe_subscription_id", "source_place_id", "created_at", "updated_at" FROM `listings`;--> statement-breakpoint
DROP TABLE `listings`;--> statement-breakpoint
ALTER TABLE `__new_listings` RENAME TO `listings`;--> statement-breakpoint
CREATE UNIQUE INDEX `listings_slug_unique` ON `listings` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `listings_source_place_id_unique` ON `listings` (`source_place_id`);--> statement-breakpoint
CREATE INDEX `listings_status_tier_idx` ON `listings` (`status`,`tier`);--> statement-breakpoint
CREATE INDEX `listings_category_idx` ON `listings` (`category_id`);--> statement-breakpoint
CREATE INDEX `listings_town_idx` ON `listings` (`town_id`);--> statement-breakpoint
CREATE TABLE `claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`method` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`message` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `claims_status_idx` ON `claims` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `claims_one_pending_per_user` ON `claims` (`listing_id`,`user_id`) WHERE status = 'pending';--> statement-breakpoint
CREATE TABLE `pending_edits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`changes` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pending_edits_status_idx` ON `pending_edits` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `pending_edits_one_open_per_listing` ON `pending_edits` (`listing_id`) WHERE status = 'pending';
