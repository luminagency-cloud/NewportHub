-- Adds 'go' (ad click redirects at /go/<id>) to the reserved slugs. SQLite cannot alter a trigger,
-- so drop and recreate all four. Keep this list in sync with RESERVED_SLUGS in src/lib/slug.ts.
DROP TRIGGER IF EXISTS `categories_slug_guard_insert`;
--> statement-breakpoint
CREATE TRIGGER `categories_slug_guard_insert` BEFORE INSERT ON `categories`
FOR EACH ROW
WHEN NEW.slug IN (SELECT slug FROM `towns`) OR NEW.slug IN ('listing', 'search', 'media', 'api', 'admin', 'account', 'login', 'logout', 'signup', 'dashboard', 'claim', 'pricing', 'about', 'contact', 'privacy', 'terms', 'sitemap', 'robots', '_astro', '_image', 'go')
BEGIN
  SELECT RAISE(ABORT, 'slug clash: slug is used by towns or is a reserved route');
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `categories_slug_guard_update`;
--> statement-breakpoint
CREATE TRIGGER `categories_slug_guard_update` BEFORE UPDATE OF `slug` ON `categories`
FOR EACH ROW
WHEN NEW.slug IN (SELECT slug FROM `towns`) OR NEW.slug IN ('listing', 'search', 'media', 'api', 'admin', 'account', 'login', 'logout', 'signup', 'dashboard', 'claim', 'pricing', 'about', 'contact', 'privacy', 'terms', 'sitemap', 'robots', '_astro', '_image', 'go')
BEGIN
  SELECT RAISE(ABORT, 'slug clash: slug is used by towns or is a reserved route');
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `towns_slug_guard_insert`;
--> statement-breakpoint
CREATE TRIGGER `towns_slug_guard_insert` BEFORE INSERT ON `towns`
FOR EACH ROW
WHEN NEW.slug IN (SELECT slug FROM `categories`) OR NEW.slug IN ('listing', 'search', 'media', 'api', 'admin', 'account', 'login', 'logout', 'signup', 'dashboard', 'claim', 'pricing', 'about', 'contact', 'privacy', 'terms', 'sitemap', 'robots', '_astro', '_image', 'go')
BEGIN
  SELECT RAISE(ABORT, 'slug clash: slug is used by categories or is a reserved route');
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `towns_slug_guard_update`;
--> statement-breakpoint
CREATE TRIGGER `towns_slug_guard_update` BEFORE UPDATE OF `slug` ON `towns`
FOR EACH ROW
WHEN NEW.slug IN (SELECT slug FROM `categories`) OR NEW.slug IN ('listing', 'search', 'media', 'api', 'admin', 'account', 'login', 'logout', 'signup', 'dashboard', 'claim', 'pricing', 'about', 'contact', 'privacy', 'terms', 'sitemap', 'robots', '_astro', '_image', 'go')
BEGIN
  SELECT RAISE(ABORT, 'slug clash: slug is used by categories or is a reserved route');
END;
