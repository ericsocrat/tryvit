-- Phase 4E scoped post-enrichment processing.
-- Applies the existing deterministic allergen and concern rules only to the
-- four approved Phase 4E category-country scopes. Non-target products are
-- intentionally excluded from every write.

BEGIN;

-- Remove any governed nutrition-label artifact linkage from an earlier local
-- attempt. Clean generation never inserts these rows; this keeps reruns safe.
DELETE FROM product_ingredient pi
USING ingredient_ref ir, products p
WHERE pi.ingredient_id = ir.ingredient_id
  AND pi.product_id = p.product_id
  AND ir.name_en ~* '^(kcal|kj\b|per 100)'
  AND p.is_deprecated IS NOT TRUE
  AND (
    (p.category = 'Snacks' AND p.country = 'DE')
    OR (p.category = 'Instant & Frozen' AND p.country = 'DE')
    OR (p.category = 'Bread' AND p.country = 'DE')
    OR (p.category = 'Spreads & Dips' AND p.country = 'DE')
  );

DELETE FROM ingredient_ref ir
WHERE ir.name_en ~* '^(kcal|kj\b|per 100)'
  AND NOT EXISTS (
    SELECT 1 FROM product_ingredient pi WHERE pi.ingredient_id = ir.ingredient_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM product_ingredient pi WHERE pi.parent_ingredient_id = ir.ingredient_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_translations it WHERE it.ingredient_id = ir.ingredient_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM recipe_ingredient ri WHERE ri.ingredient_ref_id = ir.ingredient_id
  );

-- Classify additive concern tiers for ingredient identities linked to the
-- approved scopes. This mirrors db/ci_post_enrichment.sql Step 0e.
WITH target_ingredients AS (
  SELECT DISTINCT pi.ingredient_id
  FROM product_ingredient pi
  JOIN products p ON p.product_id = pi.product_id
  WHERE p.is_deprecated IS NOT TRUE
    AND (
      (p.category = 'Snacks' AND p.country = 'DE')
      OR (p.category = 'Instant & Frozen' AND p.country = 'DE')
      OR (p.category = 'Bread' AND p.country = 'DE')
      OR (p.category = 'Spreads & Dips' AND p.country = 'DE')
    )
),
normalized AS (
  SELECT
    ir.ingredient_id,
    CASE
      WHEN lower(ir.name_en) ~ '^\s*e[ -]?[0-9]{3,4}[a-z]?($|[^a-z0-9])'
      THEN regexp_replace(
        substring(lower(ir.name_en) from '^\s*e[ -]?[0-9]{3,4}[a-z]?'),
        '[^a-z0-9]',
        '',
        'g'
      )
      ELSE ''
    END AS e_code,
    lower(ir.name_en) AS normalized_name
  FROM ingredient_ref ir
  JOIN target_ingredients ti ON ti.ingredient_id = ir.ingredient_id
),
classified AS (
  SELECT
    ingredient_id,
    CASE
      WHEN e_code IN ('e250','e252')
        OR normalized_name LIKE '%sodium nitrite%'
        OR normalized_name LIKE '%potassium nitrate%'
      THEN 3
      WHEN e_code IN ('e133','e150d','e211','e220','e223','e319','e385','e407','e407a','e621','e950','e951','e955')
        OR normalized_name LIKE '%sodium benzoate%'
        OR normalized_name LIKE '%benzoate%'
        OR normalized_name LIKE '%sucralose%'
        OR normalized_name LIKE '%aspartame%'
        OR normalized_name LIKE '%carrageenan%'
        OR normalized_name LIKE '%sodium metabisulphite%'
        OR normalized_name LIKE '%contains sulphites%'
        OR normalized_name IN ('sulfite','sulfiten','sulphite','sulphites')
      THEN 2
      WHEN e_code IN (
        'e150','e150a','e150b','e150c','e172','e200','e202',
        'e281','e282','e338','e339','e340','e341',
        'e420','e421','e422','e440','e450','e451','e452',
        'e460','e466','e471','e472','e500','e501','e503',
        'e960','e960a','e960c'
      )
        OR normalized_name LIKE '%potassium sorbate%'
        OR normalized_name LIKE '%sorbate%'
      THEN 1
      ELSE 0
    END AS target_concern_tier
  FROM normalized
)
UPDATE ingredient_ref ir
SET concern_tier = GREATEST(COALESCE(ir.concern_tier, 0), c.target_concern_tier),
    is_additive = true,
    concern_reason = COALESCE(
      NULLIF(trim(ir.concern_reason), ''),
      'Phase 4E scoped deterministic additive/E-code classifier'
    )
FROM classified c
WHERE ir.ingredient_id = c.ingredient_id
  AND c.target_concern_tier > 0
  AND (
    COALESCE(ir.concern_tier, 0) < c.target_concern_tier
    OR ir.is_additive IS DISTINCT FROM true
    OR ir.concern_reason IS NULL
    OR trim(ir.concern_reason) = ''
  );

-- Derive only the allergen relationships permitted by the Phase 4C rules.
-- Explicit contains/traces rows were already inserted by the generated SQL.
WITH target_links AS (
  SELECT pi.product_id, lower(ir.name_en) AS ingredient_name
  FROM product_ingredient pi
  JOIN ingredient_ref ir ON ir.ingredient_id = pi.ingredient_id
  JOIN products p ON p.product_id = pi.product_id
  WHERE p.is_deprecated IS NOT TRUE
    AND (
      (p.category = 'Snacks' AND p.country = 'DE')
      OR (p.category = 'Instant & Frozen' AND p.country = 'DE')
      OR (p.category = 'Bread' AND p.country = 'DE')
      OR (p.category = 'Spreads & Dips' AND p.country = 'DE')
    )
),
derived AS (
  SELECT DISTINCT product_id, 'milk'::text AS tag
  FROM target_links
  WHERE ingredient_name LIKE ANY(ARRAY[
    '%milk%','%cream%','%butter%','%cheese%','%whey%','%lactose%','%casein%'
  ])
    AND NOT (ingredient_name LIKE ANY(ARRAY[
      '%cocoa butter%','%shea butter%','%peanut butter%','%nut butter%',
      '%coconut milk%','%coconut cream%','%almond milk%','%oat milk%',
      '%soy milk%','%rice milk%','%cashew milk%','%cream of tartar%',
      '%ice cream plant%','%buttercup%','%lactic acid%','%cream soda%',
      '%factory%handles%','%produced%facility%'
    ]))
  UNION
  SELECT DISTINCT product_id, 'gluten'
  FROM target_links
  WHERE ingredient_name LIKE ANY(ARRAY[
    '%wheat%','%barley%','%rye%','%spelt%','%oats%','%oatmeal%',
    '%oat flake%','%oat bran%','%oat fibre%','%oat fiber%','%rolled oat%',
    '%owsian%','%owies%','%haferfloc%','%haferkl%'
  ])
    AND ingredient_name NOT LIKE '%buckwheat%'
    AND ingredient_name NOT LIKE '%benzoate%'
    AND ingredient_name NOT LIKE '%coat%'
  UNION
  SELECT DISTINCT product_id, 'eggs'
  FROM target_links
  WHERE ingredient_name LIKE '%egg%'
    AND NOT (ingredient_name LIKE ANY(ARRAY['%eggplant%','%reggiano%','%egg noodle%']))
  UNION
  SELECT DISTINCT product_id, 'soybeans'
  FROM target_links
  WHERE ingredient_name LIKE ANY(ARRAY['%soy%','%soja%'])
  UNION
  SELECT DISTINCT product_id, 'fish'
  FROM target_links
  WHERE ingredient_name LIKE ANY(ARRAY[
    '%fish%','%salmon%','%tuna%','%herring%','%mackerel%','%anchov%','%cod %','%trout%'
  ])
  UNION
  SELECT DISTINCT product_id, 'peanuts'
  FROM target_links
  WHERE ingredient_name LIKE '%peanut%'
)
INSERT INTO product_allergen_info (product_id, tag, type, evidence_basis)
SELECT product_id, tag, 'contains', 'ingredient_derived'
FROM derived
ON CONFLICT (product_id, tag, type) DO NOTHING;

-- Preserve the repository's top-level position invariant, scoped to Phase 4E.
DO $$
DECLARE
  row_to_fix RECORD;
BEGIN
  FOR row_to_fix IN
    SELECT pi_sub.product_id,
           pi_sub.ingredient_id AS sub_ingredient_id,
           pi_sub.position AS sub_position,
           first_top.ingredient_id AS top_ingredient_id,
           first_top.position AS top_position
    FROM product_ingredient pi_sub
    JOIN products p ON p.product_id = pi_sub.product_id
    JOIN (
      SELECT product_id, MIN(position) AS minimum_top_position
      FROM product_ingredient
      WHERE is_sub_ingredient IS NOT TRUE
      GROUP BY product_id
      HAVING MIN(position) <> 1
    ) misplaced
      ON misplaced.product_id = pi_sub.product_id
     AND pi_sub.position = 1
    JOIN product_ingredient first_top
      ON first_top.product_id = misplaced.product_id
     AND first_top.position = misplaced.minimum_top_position
    WHERE pi_sub.is_sub_ingredient = true
      AND p.is_deprecated IS NOT TRUE
      AND (
        (p.category = 'Snacks' AND p.country = 'DE')
        OR (p.category = 'Instant & Frozen' AND p.country = 'DE')
        OR (p.category = 'Bread' AND p.country = 'DE')
        OR (p.category = 'Spreads & Dips' AND p.country = 'DE')
      )
  LOOP
    UPDATE product_ingredient
    SET position = 9999
    WHERE product_id = row_to_fix.product_id
      AND ingredient_id = row_to_fix.sub_ingredient_id
      AND position = row_to_fix.sub_position;

    UPDATE product_ingredient
    SET position = row_to_fix.sub_position
    WHERE product_id = row_to_fix.product_id
      AND ingredient_id = row_to_fix.top_ingredient_id
      AND position = row_to_fix.top_position;

    UPDATE product_ingredient
    SET position = row_to_fix.top_position
    WHERE product_id = row_to_fix.product_id
      AND ingredient_id = row_to_fix.sub_ingredient_id
      AND position = 9999;
  END LOOP;
END $$;

-- Re-score only the approved category-country scopes. score_category also
-- refreshes the confidence materialized view after each deterministic call.
CALL score_category('Snacks', p_country := 'DE');
CALL score_category('Instant & Frozen', p_country := 'DE');
CALL score_category('Bread', p_country := 'DE');
CALL score_category('Spreads & Dips', p_country := 'DE');

COMMIT;

-- Keep repository-wide analytical views synchronized with the scoped writes.
-- The refresh is read-derived and does not mutate product or linkage rows.
SELECT refresh_all_materialized_views();
