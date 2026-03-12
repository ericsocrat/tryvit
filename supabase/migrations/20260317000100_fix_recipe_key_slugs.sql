-- Migration: Fix recipe i18n key slugs — underscores → hyphens
-- The seed migration (20260222000100) used underscores in slug segments of
-- name_key / title_key / description_key / content_key values (e.g.
-- "recipes.items.overnight_oats.title").  The en/pl/de JSON dictionaries
-- use hyphens ("recipes.items.overnight-oats.title").  This mismatch causes
-- the frontend t() function to miss translations and fall back to
-- humanizeKey(), which shows raw numbers for ingredient keys.
--
-- Fix: replace underscores with hyphens inside the slug segment of every
-- recipe-related key.  Structural segments (recipes, items, title, steps,
-- ingredients) contain no underscores, so a blanket REPLACE is safe.
--
-- Rollback: UPDATE recipe SET title_key = REPLACE(title_key, '-', '_'),
--           description_key = REPLACE(description_key, '-', '_');
--           UPDATE recipe_step SET content_key = REPLACE(content_key, '-', '_');
--           UPDATE recipe_ingredient SET name_key = REPLACE(name_key, '-', '_');

-- recipe table: title_key + description_key
UPDATE public.recipe
SET title_key       = REPLACE(title_key, '_', '-'),
    description_key = REPLACE(description_key, '_', '-')
WHERE title_key LIKE '%\_%' ESCAPE '\';

-- recipe_step table: content_key
UPDATE public.recipe_step
SET content_key = REPLACE(content_key, '_', '-')
WHERE content_key LIKE '%\_%' ESCAPE '\';

-- recipe_ingredient table: name_key
UPDATE public.recipe_ingredient
SET name_key = REPLACE(name_key, '_', '-')
WHERE name_key LIKE '%\_%' ESCAPE '\';
