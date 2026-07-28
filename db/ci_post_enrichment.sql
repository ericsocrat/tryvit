-- Post-enrichment: clean ingredient data, infer allergens, recompute scores
-- This file runs AFTER enrich_ingredients.py populates product_ingredient + product_allergen_info
-- It bridges the gap between enrichment data and the scoring pipeline.
--
-- Rollback: Re-run score_category() for all categories (resets scores from current data)

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- Step 0a: Clean junk ingredient names from OFF API parser artifacts
-- ═══════════════════════════════════════════════════════════════
-- Remove bare numbers, single-char names, and nutrition label fragments
-- that the OFF API parser sometimes produces.

DELETE FROM product_ingredient
WHERE ingredient_id IN (
    SELECT ingredient_id FROM ingredient_ref
    WHERE name_en ~ '^\d+$'
       OR length(trim(name_en)) <= 1
       OR name_en ~* '^(per 100|kcal|kj\b)'
);

DELETE FROM ingredient_ref
WHERE name_en ~ '^\d+$'
   OR length(trim(name_en)) <= 1
   OR name_en ~* '^(per 100|kcal|kj\b)';

-- ═══════════════════════════════════════════════════════════════
-- Step 0b: Infer allergen declarations from ingredient data
-- ═══════════════════════════════════════════════════════════════
-- Products whose ingredients clearly indicate an allergen (e.g. "milk",
-- "wheat flour") but lack a matching product_allergen_info row get one
-- inferred here.  Logic mirrors QA__allergen_integrity checks 9-14.

-- Milk (excludes cocoa butter, coconut milk, lactic acid, etc.)
INSERT INTO product_allergen_info (product_id, tag, type)
SELECT DISTINCT pi.product_id, 'milk', 'contains'
FROM product_ingredient pi
JOIN ingredient_ref ir ON ir.ingredient_id = pi.ingredient_id
JOIN products p ON p.product_id = pi.product_id AND p.is_deprecated IS NOT TRUE
WHERE ir.name_en ILIKE ANY(ARRAY[
    '%milk%','%cream%','%butter%','%cheese%','%whey%','%lactose%','%casein%'
])
AND NOT (ir.name_en ILIKE ANY(ARRAY[
    '%cocoa butter%','%shea butter%','%peanut butter%','%nut butter%',
    '%coconut milk%','%coconut cream%','%almond milk%','%oat milk%',
    '%soy milk%','%rice milk%','%cashew milk%','%cream of tartar%',
    '%ice cream plant%','%buttercup%','%lactic acid%','%cream soda%',
    '%factory%handles%','%produced%facility%'
]))
AND NOT EXISTS (
    SELECT 1 FROM product_allergen_info pai
    WHERE pai.product_id = pi.product_id AND pai.tag = 'milk' AND pai.type = 'contains'
)
ON CONFLICT (product_id, tag, type) DO NOTHING;

-- Gluten (excludes buckwheat, benzoate, coat)
INSERT INTO product_allergen_info (product_id, tag, type)
SELECT DISTINCT pi.product_id, 'gluten', 'contains'
FROM product_ingredient pi
JOIN ingredient_ref ir ON ir.ingredient_id = pi.ingredient_id
JOIN products p ON p.product_id = pi.product_id AND p.is_deprecated IS NOT TRUE
WHERE ir.name_en ILIKE ANY(ARRAY[
    '%wheat%','%barley%','%rye%','%spelt%',
    '%oats%','%oatmeal%','%oat flake%','%oat bran%','%oat fibre%',
    '%oat fiber%','%rolled oat%',
    '%owsian%','%owies%',
    '%haferfloc%','%haferkl%'
])
AND ir.name_en NOT ILIKE '%buckwheat%'
AND ir.name_en NOT ILIKE '%benzoate%'
AND ir.name_en NOT ILIKE '%coat%'
AND NOT EXISTS (
    SELECT 1 FROM product_allergen_info pai
    WHERE pai.product_id = pi.product_id AND pai.tag = 'gluten' AND pai.type = 'contains'
)
ON CONFLICT (product_id, tag, type) DO NOTHING;

-- Eggs (excludes eggplant, reggiano, egg noodle)
INSERT INTO product_allergen_info (product_id, tag, type)
SELECT DISTINCT pi.product_id, 'eggs', 'contains'
FROM product_ingredient pi
JOIN ingredient_ref ir ON ir.ingredient_id = pi.ingredient_id
JOIN products p ON p.product_id = pi.product_id AND p.is_deprecated IS NOT TRUE
WHERE ir.name_en ILIKE ANY(ARRAY['%egg%'])
AND NOT (ir.name_en ILIKE ANY(ARRAY['%eggplant%','%reggiano%','%egg noodle%']))
AND NOT EXISTS (
    SELECT 1 FROM product_allergen_info pai
    WHERE pai.product_id = pi.product_id AND pai.tag = 'eggs' AND pai.type = 'contains'
)
ON CONFLICT (product_id, tag, type) DO NOTHING;

-- Soybeans
INSERT INTO product_allergen_info (product_id, tag, type)
SELECT DISTINCT pi.product_id, 'soybeans', 'contains'
FROM product_ingredient pi
JOIN ingredient_ref ir ON ir.ingredient_id = pi.ingredient_id
JOIN products p ON p.product_id = pi.product_id AND p.is_deprecated IS NOT TRUE
WHERE ir.name_en ILIKE ANY(ARRAY['%soy%','%soja%'])
AND NOT EXISTS (
    SELECT 1 FROM product_allergen_info pai
    WHERE pai.product_id = pi.product_id AND pai.tag = 'soybeans' AND pai.type = 'contains'
)
ON CONFLICT (product_id, tag, type) DO NOTHING;

-- Fish
INSERT INTO product_allergen_info (product_id, tag, type)
SELECT DISTINCT pi.product_id, 'fish', 'contains'
FROM product_ingredient pi
JOIN ingredient_ref ir ON ir.ingredient_id = pi.ingredient_id
JOIN products p ON p.product_id = pi.product_id AND p.is_deprecated IS NOT TRUE
WHERE ir.name_en ILIKE ANY(ARRAY[
    '%fish%','%salmon%','%tuna%','%herring%','%mackerel%','%anchov%','%cod %','%trout%'
])
AND NOT EXISTS (
    SELECT 1 FROM product_allergen_info pai
    WHERE pai.product_id = pi.product_id AND pai.tag = 'fish' AND pai.type = 'contains'
)
ON CONFLICT (product_id, tag, type) DO NOTHING;

-- Peanuts
INSERT INTO product_allergen_info (product_id, tag, type)
SELECT DISTINCT pi.product_id, 'peanuts', 'contains'
FROM product_ingredient pi
JOIN ingredient_ref ir ON ir.ingredient_id = pi.ingredient_id
JOIN products p ON p.product_id = pi.product_id AND p.is_deprecated IS NOT TRUE
WHERE ir.name_en ILIKE '%peanut%'
AND NOT EXISTS (
    SELECT 1 FROM product_allergen_info pai
    WHERE pai.product_id = pi.product_id AND pai.tag = 'peanuts' AND pai.type = 'contains'
)
ON CONFLICT (product_id, tag, type) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- Step 0c: Fix ingredient position ordering
-- ═══════════════════════════════════════════════════════════════
-- After enrichment, some products may have a sub-ingredient at
-- position 1 while the first top-level ingredient is at position 2+.
-- QA check 8 (ingredient_quality) requires top-level position starts at 1.
-- Fix: swap the earliest sub-ingredient with the earliest top-level.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT pi_sub.product_id,
           pi_sub.ingredient_id AS sub_ing_id,
           pi_sub.position      AS sub_pos,
           first_top.ingredient_id AS top_ing_id,
           first_top.position      AS top_pos
    FROM product_ingredient pi_sub
    JOIN (
      SELECT product_id, MIN(position) AS min_top_pos
      FROM product_ingredient
      WHERE is_sub_ingredient IS NOT TRUE
      GROUP BY product_id
      HAVING MIN(position) <> 1
    ) bad ON bad.product_id = pi_sub.product_id AND pi_sub.position = 1
    JOIN product_ingredient first_top
      ON first_top.product_id = bad.product_id
     AND first_top.position = bad.min_top_pos
    WHERE pi_sub.is_sub_ingredient = true
  LOOP
    -- Swap via temp position 9999
    UPDATE product_ingredient SET position = 9999
    WHERE product_id = r.product_id AND ingredient_id = r.sub_ing_id AND position = r.sub_pos;

    UPDATE product_ingredient SET position = r.sub_pos
    WHERE product_id = r.product_id AND ingredient_id = r.top_ing_id AND position = r.top_pos;

    UPDATE product_ingredient SET position = r.top_pos
    WHERE product_id = r.product_id AND ingredient_id = r.sub_ing_id AND position = 9999;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Step 0d: Remove ingredient data for deprecated products
-- ═══════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════
-- Keeps MV row counts consistent (mv_ingredient_frequency excludes
-- deprecated products via JOIN, but product_ingredient doesn't).

DELETE FROM product_ingredient
WHERE product_id IN (SELECT product_id FROM products WHERE is_deprecated = true);

DELETE FROM product_allergen_info
WHERE product_id IN (SELECT product_id FROM products WHERE is_deprecated = true);

-- Remove orphan ingredient_ref entries left behind (only used by deprecated products)
DELETE FROM ingredient_ref
WHERE NOT EXISTS (
    SELECT 1 FROM product_ingredient pi WHERE pi.ingredient_id = ingredient_ref.ingredient_id
)
AND NOT EXISTS (
    SELECT 1 FROM product_ingredient pi WHERE pi.parent_ingredient_id = ingredient_ref.ingredient_id
)
AND EXISTS (SELECT 1 FROM product_ingredient LIMIT 1);

-- ═══════════════════════════════════════════════════════════════
-- Step 0e: Classify additive/E-code concern tiers
-- ═══════════════════════════════════════════════════════════════
-- Uses strict start-of-string E-code extraction to avoid false positives
-- such as "200 G", "Type 500", or nutrition text.

WITH normalized AS (
  SELECT
    ingredient_id,
    name_en,
    CASE
      WHEN lower(name_en) ~ '^\s*e[ -]?[0-9]{3,4}[a-z]?($|[^a-z0-9])'
      THEN regexp_replace(
        substring(lower(name_en) from '^\s*e[ -]?[0-9]{3,4}[a-z]?'),
        '[^a-z0-9]',
        '',
        'g'
      )
      ELSE ''
    END AS e_code,
    lower(name_en) AS n
  FROM ingredient_ref
  WHERE name_en IS NOT NULL
),
classified AS (
  SELECT
    ingredient_id,
    CASE
      WHEN e_code IN ('e250','e252')
        OR n LIKE '%sodium nitrite%'
        OR n LIKE '%potassium nitrate%'
      THEN 3

      WHEN e_code IN ('e133','e150d','e211','e220','e223','e319','e385','e407','e407a','e621','e950','e951','e955')
        OR n LIKE '%sodium benzoate%'
        OR n LIKE '%benzoate%'
        OR n LIKE '%sucralose%'
        OR n LIKE '%aspartame%'
        OR n LIKE '%carrageenan%'
        OR n LIKE '%sodium metabisulphite%'
        OR n LIKE '%contains sulphites%'
        OR n IN ('sulfite','sulfiten','sulphite','sulphites')
      THEN 2

      WHEN e_code IN (
        'e150','e150a','e150b','e150c','e172','e200','e202',
        'e281','e282','e338','e339','e340','e341',
        'e420','e421','e422','e440','e450','e451','e452',
        'e460','e466','e471','e472','e500','e501','e503',
        'e960','e960a','e960c'
      )
        OR n LIKE '%potassium sorbate%'
        OR n LIKE '%sorbate%'
      THEN 1

      ELSE 0
    END AS target_concern_tier,
    CASE
      WHEN e_code IN ('e250','e252')
        OR n LIKE '%sodium nitrite%'
        OR n LIKE '%potassium nitrate%'
      THEN 'Strict additive/E-code classifier: nitrite/nitrate preservative concern'

      WHEN e_code IN ('e133','e150d','e211','e220','e223','e319','e385','e407','e407a','e621','e950','e951','e955')
        OR n LIKE '%sodium benzoate%'
        OR n LIKE '%benzoate%'
        OR n LIKE '%sucralose%'
        OR n LIKE '%aspartame%'
        OR n LIKE '%carrageenan%'
        OR n LIKE '%sodium metabisulphite%'
        OR n LIKE '%contains sulphites%'
        OR n IN ('sulfite','sulfiten','sulphite','sulphites')
      THEN 'Strict additive/E-code classifier: preservative, sweetener, sulphite, or carrageenan concern'

      WHEN e_code IN (
        'e150','e150a','e150b','e150c','e172','e200','e202',
        'e281','e282','e338','e339','e340','e341',
        'e420','e421','e422','e440','e450','e451','e452',
        'e460','e466','e471','e472','e500','e501','e503',
        'e960','e960a','e960c'
      )
        OR n LIKE '%potassium sorbate%'
        OR n LIKE '%sorbate%'
      THEN 'Strict additive/E-code classifier: lower concern additive or sorbate'

      ELSE NULL
    END AS target_concern_reason
  FROM normalized
)
UPDATE ingredient_ref ir
SET
  concern_tier = GREATEST(COALESCE(ir.concern_tier, 0), c.target_concern_tier),
  is_additive = true,
  concern_reason = CASE
    WHEN ir.concern_reason IS NULL OR trim(ir.concern_reason) = ''
    THEN c.target_concern_reason
    ELSE ir.concern_reason
  END
FROM classified c
WHERE ir.ingredient_id = c.ingredient_id
  AND c.target_concern_tier > 0
  AND (
    COALESCE(ir.concern_tier, 0) < c.target_concern_tier
    OR ir.is_additive IS DISTINCT FROM true
    OR ir.concern_reason IS NULL
    OR trim(ir.concern_reason) = ''
  );

-- ═══════════════════════════════════════════════════════════════
-- Step 1: Populate ingredient_concern_score from actual ingredient data
-- ═══════════════════════════════════════════════════════════════
-- Based on EFSA concern tiers: tier 1 = 15pts, tier 2 = 40pts, tier 3 = 100pts
-- Capped at LEAST(100, SUM(...)) per SCORING_METHODOLOGY.md v3.2

WITH product_scores AS (
  SELECT
    pi.product_id,
    LEAST(100, SUM(
      CASE ir.concern_tier
        WHEN 1 THEN 15
        WHEN 2 THEN 40
        WHEN 3 THEN 100
        ELSE 0
      END
    ))::int AS score
  FROM product_ingredient pi
  JOIN ingredient_ref ir ON ir.ingredient_id = pi.ingredient_id
  WHERE COALESCE(ir.concern_tier, 0) > 0
  GROUP BY pi.product_id
),
computed_scores AS (
  SELECT
    p.product_id,
    COALESCE(ps.score, 0)::int AS score
  FROM products p
  LEFT JOIN product_scores ps ON ps.product_id = p.product_id
  WHERE p.is_deprecated IS NOT TRUE
)
UPDATE products p
SET ingredient_concern_score = cs.score
FROM computed_scores cs
WHERE p.product_id = cs.product_id
  AND p.is_deprecated IS NOT TRUE
  AND p.ingredient_concern_score IS DISTINCT FROM cs.score;

-- ═══════════════════════════════════════════════════════════════
-- Step 2: Flag palm oil controversy from actual ingredient data
-- ═══════════════════════════════════════════════════════════════

UPDATE products p
SET controversies = 'palm oil'
FROM (
    SELECT DISTINCT pi.product_id
    FROM product_ingredient pi
    JOIN ingredient_ref ir ON ir.ingredient_id = pi.ingredient_id
    WHERE ir.from_palm_oil = 'yes'
) palm
WHERE palm.product_id = p.product_id
  AND p.is_deprecated IS NOT TRUE
  AND p.controversies = 'none';

-- ═══════════════════════════════════════════════════════════════
-- Step 3: Re-score all categories (propagates concern scores into unhealthiness)
-- ═══════════════════════════════════════════════════════════════

CALL score_category('Alcohol');
CALL score_category('Baby');
CALL score_category('Bread');
CALL score_category('Breakfast & Grain-Based');
CALL score_category('Canned Goods');
CALL score_category('Cereals');
CALL score_category('Chips');
CALL score_category('Condiments');
CALL score_category('Dairy');
CALL score_category('Drinks');
CALL score_category('Frozen & Prepared');
CALL score_category('Instant & Frozen');
CALL score_category('Meat');
CALL score_category('Nuts, Seeds & Legumes');
CALL score_category('Plant-Based & Alternatives');
CALL score_category('Sauces');
CALL score_category('Seafood & Fish');
CALL score_category('Snacks');
CALL score_category('Sweets');
CALL score_category('Żabka');

-- DE categories (all 19)
CALL score_category('Alcohol',                  p_country := 'DE');
CALL score_category('Baby',                     p_country := 'DE');
CALL score_category('Bread',                    p_country := 'DE');
CALL score_category('Breakfast & Grain-Based',  p_country := 'DE');
CALL score_category('Canned Goods',             p_country := 'DE');
CALL score_category('Cereals',                  p_country := 'DE');
CALL score_category('Chips',                    p_country := 'DE');
CALL score_category('Condiments',               p_country := 'DE');
CALL score_category('Dairy',                    p_country := 'DE');
CALL score_category('Drinks',                   p_country := 'DE');
CALL score_category('Frozen & Prepared',        p_country := 'DE');
CALL score_category('Instant & Frozen',         p_country := 'DE');
CALL score_category('Meat',                     p_country := 'DE');
CALL score_category('Nuts, Seeds & Legumes',    p_country := 'DE');
CALL score_category('Plant-Based & Alternatives', p_country := 'DE');
CALL score_category('Sauces',                   p_country := 'DE');
CALL score_category('Seafood & Fish',           p_country := 'DE');
CALL score_category('Snacks',                   p_country := 'DE');
CALL score_category('Sweets',                   p_country := 'DE');

-- Reconcile every active category-country pair, including pipeline-specific
-- categories (for example Frozen Vegetables, Soups, Ready Meals, and
-- Desserts & Ice Cream) that are not represented in the legacy call list.
-- This keeps enrichment changes and stored v3.3 scores in parity.
DO $reconcile_scores$
DECLARE
  scope record;
BEGIN
  FOR scope IN
    SELECT DISTINCT country, category
    FROM products
    WHERE is_deprecated IS NOT TRUE
    ORDER BY country, category
  LOOP
    CALL score_category(scope.category, 100, scope.country);
  END LOOP;
END
$reconcile_scores$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- Step 4: Refresh materialized views
-- ═══════════════════════════════════════════════════════════════
-- Must run AFTER COMMIT because some MVs use CONCURRENTLY refresh.
-- Ensures v_product_confidence, mv_product_similarity, and
-- mv_ingredient_frequency reflect the updated scores.
SELECT refresh_all_materialized_views();
