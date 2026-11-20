-- Google attributes (accessibility, ownership, parking, …) from Outscraper's `about` column.
-- The first production import (before 2.6.0) stored that JSON as the description. On 2026-11-20 the
-- 138 affected production descriptions were copied into listing_attributes_stash (created by hand,
-- same shape as below) and cleared. This moves them into the new column. Elsewhere the stash table
-- is created empty, and any description still holding that JSON is moved instead (unclaimed,
-- never-edited listings only, like the importer).
ALTER TABLE `listings` ADD `attributes` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `listing_attributes_stash` (`listing_id` integer PRIMARY KEY NOT NULL, `about` text NOT NULL);
--> statement-breakpoint
UPDATE `listings` SET `attributes` = (SELECT `about` FROM `listing_attributes_stash` s WHERE s.`listing_id` = `listings`.`id`)
WHERE `id` IN (SELECT `listing_id` FROM `listing_attributes_stash`) AND `attributes` IS NULL;
--> statement-breakpoint
UPDATE `listings` SET `attributes` = `description`, `description` = NULL
WHERE ltrim(`description`) LIKE '{%' AND json_valid(`description`) AND `owner_user_id` IS NULL
  AND NOT EXISTS (SELECT 1 FROM `listing_changes` c WHERE c.`listing_id` = `listings`.`id`);
--> statement-breakpoint
DROP TABLE `listing_attributes_stash`;
