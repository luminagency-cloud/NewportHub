-- /[slug]/ serves both categories and towns, so a slug must be unique across both tables
-- and must not shadow a fixed route. Keep this reserved list in sync with src/lib/slug.ts.
CREATE TRIGGER `categories_slug_guard_insert` BEFORE INSERT ON `categories`
FOR EACH ROW
WHEN NEW.slug IN (SELECT slug FROM `towns`) OR NEW.slug IN ('listing', 'search', 'media', 'api', 'admin', 'account', 'login', 'logout', 'signup', 'dashboard', 'claim', 'pricing', 'about', 'contact', 'privacy', 'terms', 'sitemap', 'robots', '_astro', '_image')
BEGIN
  SELECT RAISE(ABORT, 'slug clash: slug is used by towns or is a reserved route');
END;
--> statement-breakpoint
CREATE TRIGGER `categories_slug_guard_update` BEFORE UPDATE OF `slug` ON `categories`
FOR EACH ROW
WHEN NEW.slug IN (SELECT slug FROM `towns`) OR NEW.slug IN ('listing', 'search', 'media', 'api', 'admin', 'account', 'login', 'logout', 'signup', 'dashboard', 'claim', 'pricing', 'about', 'contact', 'privacy', 'terms', 'sitemap', 'robots', '_astro', '_image')
BEGIN
  SELECT RAISE(ABORT, 'slug clash: slug is used by towns or is a reserved route');
END;
--> statement-breakpoint
CREATE TRIGGER `towns_slug_guard_insert` BEFORE INSERT ON `towns`
FOR EACH ROW
WHEN NEW.slug IN (SELECT slug FROM `categories`) OR NEW.slug IN ('listing', 'search', 'media', 'api', 'admin', 'account', 'login', 'logout', 'signup', 'dashboard', 'claim', 'pricing', 'about', 'contact', 'privacy', 'terms', 'sitemap', 'robots', '_astro', '_image')
BEGIN
  SELECT RAISE(ABORT, 'slug clash: slug is used by categories or is a reserved route');
END;
--> statement-breakpoint
CREATE TRIGGER `towns_slug_guard_update` BEFORE UPDATE OF `slug` ON `towns`
FOR EACH ROW
WHEN NEW.slug IN (SELECT slug FROM `categories`) OR NEW.slug IN ('listing', 'search', 'media', 'api', 'admin', 'account', 'login', 'logout', 'signup', 'dashboard', 'claim', 'pricing', 'about', 'contact', 'privacy', 'terms', 'sitemap', 'robots', '_astro', '_image')
BEGIN
  SELECT RAISE(ABORT, 'slug clash: slug is used by categories or is a reserved route');
END;
