CREATE TABLE `category_aliases` (
	`alias` text PRIMARY KEY NOT NULL,
	`category_id` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `import_unmapped` (
	`source_category` text PRIMARY KEY NOT NULL,
	`rows` integer DEFAULT 0 NOT NULL,
	`example` text,
	`last_seen` integer
);
--> statement-breakpoint
ALTER TABLE `categories` ADD `parent_id` integer REFERENCES categories(id);--> statement-breakpoint
ALTER TABLE `categories` ADD `broken_out` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `categories_parent_idx` ON `categories` (`parent_id`);