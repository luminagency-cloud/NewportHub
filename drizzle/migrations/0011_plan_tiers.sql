-- In-place change. Do not rebuild `listings`.
-- DROP TABLE listings fires ON DELETE CASCADE on slug_redirects and listing_stats.
-- defer_foreign_keys does not suppress those cascades, and D1 ignores
-- PRAGMA foreign_keys=OFF. A claim or pending edit (ON DELETE NO ACTION) then
-- fails the commit with FOREIGN KEY constraint failed, even after the listing
-- rows are copied back.
-- New columns are nullable, so ADD COLUMN does not rewrite the table.
-- Tier keys: featured (old middle plan) → plus, then premium → featured, then free → basic.
-- Rename the old middle plan before premium takes the name "featured".
-- SQLite cannot change a column default without a rebuild, so the stored default
-- on `tier` stays 'free'. The trigger rewrites that legacy default to 'basic'.
-- Application inserts set tier themselves.
UPDATE `listings` SET `tier` = 'plus' WHERE `tier` = 'featured';--> statement-breakpoint
UPDATE `listings` SET `tier` = 'featured' WHERE `tier` = 'premium';--> statement-breakpoint
UPDATE `listings` SET `tier` = 'basic' WHERE `tier` = 'free';--> statement-breakpoint
ALTER TABLE `listings` ADD `social_url` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `menu_url` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `booking_url` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `photos` text;--> statement-breakpoint
CREATE TRIGGER `listings_legacy_free_tier`
AFTER INSERT ON `listings`
WHEN NEW.`tier` = 'free'
BEGIN
  UPDATE `listings` SET `tier` = 'basic' WHERE `id` = NEW.`id` AND `tier` = 'free';
END;
