ALTER TABLE `listings` ADD `subscription_status` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `current_period_end` integer;--> statement-breakpoint
ALTER TABLE `listings` ADD `cancel_at_period_end` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `listings_stripe_subscription_idx` ON `listings` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `listings_stripe_customer_idx` ON `listings` (`stripe_customer_id`);