CREATE TABLE `listing_stats` (
	`listing_id` integer NOT NULL,
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`listing_id`, `day`, `kind`),
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `listing_stats_day_idx` ON `listing_stats` (`day`);