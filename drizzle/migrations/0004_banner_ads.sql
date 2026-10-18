CREATE TABLE `ad_stats` (
	`ad_id` integer NOT NULL,
	`day` text NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`ad_id`, `day`),
	FOREIGN KEY (`ad_id`) REFERENCES `banner_ads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `banner_ads` ADD `name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `banner_ads` ADD `alt_text` text DEFAULT '' NOT NULL;