-- Migration: Backfill ingredient concern tiers from strict additive/E-code classification.
-- Rollback: Manual rollback only. Restore affected ingredient_ref.concern_tier/is_additive/concern_reason and products.ingredient_concern_score from backup if needed.
-- Backfill ingredient_ref.concern_tier using strict additive/E-code classification.
-- Safe to re-run. Does not downgrade existing higher concern tiers.

BEGIN;

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

COMMIT;

