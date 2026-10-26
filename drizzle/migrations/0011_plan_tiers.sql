-- Hand-edited after drizzle-kit generate.
-- The generated rebuild selected social_url, menu_url, booking_url, and photos from the old
-- table (they do not exist yet) and used PRAGMA foreign_keys=OFF, which D1 ignores.
-- Tier keys: free → basic, featured (old middle plan) → plus, premium → featured (new top plan).
-- Rename the old middle plan before premium takes the name "featured".
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
UPDATE `listings` SET `tier` = 'plus' WHERE `tier` = 'featured';--> statement-breakpoint
UPDATE `listings` SET `tier` = 'featured' WHERE `tier` = 'premium';--> statement-breakpoint
UPDATE `listings` SET `tier` = 'basic' WHERE `tier` = 'free';--> statement-breakpoint
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
	`social_url` text,
	`menu_url` text,
	`booking_url` text,
	`lat` real,
	`lng` real,
	`logo_r2_key` text,
	`photos` text,
	`tier` text DEFAULT 'basic' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`owner_user_id` text,
	`claimed_at` integer,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`subscription_status` text,
	`current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`source_place_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_listings`("id", "slug", "name", "category_id", "town_id", "suggested_category", "suggested_town", "address", "phone", "website", "email", "description", "hours", "lat", "lng", "logo_r2_key", "tier", "status", "owner_user_id", "claimed_at", "stripe_customer_id", "stripe_subscription_id", "subscription_status", "current_period_end", "cancel_at_period_end", "source_place_id", "created_at", "updated_at") SELECT "id", "slug", "name", "category_id", "town_id", "suggested_category", "suggested_town", "address", "phone", "website", "email", "description", "hours", "lat", "lng", "logo_r2_key", "tier", "status", "owner_user_id", "claimed_at", "stripe_customer_id", "stripe_subscription_id", "subscription_status", "current_period_end", "cancel_at_period_end", "source_place_id", "created_at", "updated_at" FROM `listings`;--> statement-breakpoint
DROP TABLE `listings`;--> statement-breakpoint
ALTER TABLE `__new_listings` RENAME TO `listings`;--> statement-breakpoint
CREATE UNIQUE INDEX `listings_slug_unique` ON `listings` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `listings_source_place_id_unique` ON `listings` (`source_place_id`);--> statement-breakpoint
CREATE INDEX `listings_status_tier_idx` ON `listings` (`status`,`tier`);--> statement-breakpoint
CREATE INDEX `listings_category_idx` ON `listings` (`category_id`);--> statement-breakpoint
CREATE INDEX `listings_town_idx` ON `listings` (`town_id`);--> statement-breakpoint
CREATE INDEX `listings_stripe_subscription_idx` ON `listings` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `listings_stripe_customer_idx` ON `listings` (`stripe_customer_id`);
