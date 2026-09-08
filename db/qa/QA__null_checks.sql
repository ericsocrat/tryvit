-- C evidence-first semantics: load contracts/evidence_data.sql in this session.
-- Historical mathematical range/equality checks remain operator audits, not consumer validity.
-- QA: null checks (25 executable data integrity checks)
-- Run after pipelines to detect missing or incomplete data.
-- Each query returns a violation count. Every expected check must return zero.
-- Updated 2026-02-12: adapted for consolidated schema (no servings, scores,
--   product_sources, product_allergen, product_trace tables).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. MISSING REQUIRED FIELD
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '1. MISSING REQUIRED FIELD' AS check_name, COUNT(*) AS violations
FROM (SELECT product_id, country, brand, product_name,
       'MISSING REQUIRED FIELD' AS issue,
       CASE
         WHEN country IS NULL      THEN 'country is NULL'
         WHEN brand IS NULL        THEN 'brand is NULL'
         WHEN product_name IS NULL THEN 'product_name is NULL'
         WHEN category IS NULL     THEN 'category is NULL'
       END AS detail
FROM products
WHERE country IS NULL
   OR brand IS NULL
   OR product_name IS NULL
   OR category IS NULL) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. (Removed — servings table eliminated in consolidation)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. NUTRITION EVIDENCE SHAPE INVALID
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '3. NUTRITION EVIDENCE SHAPE INVALID' AS check_name, COUNT(*) AS violations
FROM (SELECT product_id,'NUTRITION EVIDENCE SHAPE INVALID' AS issue FROM qa_evidence_count_violations) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. CURRENT SCORE NOT RETIRED
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '4. CURRENT SCORE NOT RETIRED' AS check_name, COUNT(*) AS violations
FROM (SELECT product_id,'CURRENT SCORE NOT RETIRED' AS issue FROM qa_score_violations) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. MISSING QUANTITY INVENTED
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '5. MISSING QUANTITY INVENTED' AS check_name, COUNT(*) AS violations
FROM (SELECT product_id,field,'MISSING QUANTITY INVENTED' AS issue FROM qa_legacy_missing_violations) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. (Merged into #4 — identical unhealthiness_score NULL check)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. (Removed — scoring_version column dropped)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. (Removed — servings table eliminated in consolidation)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. ORPHANED NUTRITION FACT
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '9. ORPHANED NUTRITION FACT' AS check_name, COUNT(*) AS violations
FROM (SELECT nf.product_id,
       'ORPHANED NUTRITION FACT' AS issue
FROM nutrition_facts nf
LEFT JOIN products p ON p.product_id = nf.product_id
WHERE p.product_id IS NULL) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. DUPLICATE PRODUCT
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '10. DUPLICATE PRODUCT' AS check_name, COUNT(*) AS violations
FROM (SELECT country, brand, product_name,
       COUNT(*) AS duplicate_count,
       'DUPLICATE PRODUCT' AS issue
FROM products
GROUP BY country, brand, product_name
HAVING COUNT(*) > 1) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. INACTIVE COUNTRY
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '11. INACTIVE COUNTRY' AS check_name, COUNT(*) AS violations
FROM (SELECT product_id, country, brand, product_name,
       'INACTIVE COUNTRY' AS issue
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND NOT EXISTS (
      SELECT 1 FROM country_ref cr
      WHERE cr.country_code = p.country
        AND cr.is_active = true
  )) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. (Removed — scores table eliminated in consolidation)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 13–14. (Removed — ingredients table dropped in migration 20260211000600)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. NEGATIVE NUTRITION VALUE
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '15. NEGATIVE NUTRITION VALUE' AS check_name, COUNT(*) AS violations
FROM (SELECT p.product_id, p.brand, p.product_name,
       'NEGATIVE NUTRITION VALUE' AS issue,
       CASE
         WHEN nf.calories < 0        THEN 'calories = ' || nf.calories
         WHEN nf.total_fat_g < 0     THEN 'total_fat_g = ' || nf.total_fat_g
         WHEN nf.saturated_fat_g < 0 THEN 'saturated_fat_g = ' || nf.saturated_fat_g
         WHEN nf.trans_fat_g < 0     THEN 'trans_fat_g = ' || nf.trans_fat_g
         WHEN nf.carbs_g < 0         THEN 'carbs_g = ' || nf.carbs_g
         WHEN nf.sugars_g < 0        THEN 'sugars_g = ' || nf.sugars_g
         WHEN nf.fibre_g < 0         THEN 'fibre_g = ' || nf.fibre_g
         WHEN nf.protein_g < 0       THEN 'protein_g = ' || nf.protein_g
         WHEN nf.salt_g < 0          THEN 'salt_g = ' || nf.salt_g
       END AS detail
FROM nutrition_facts nf
JOIN products p ON p.product_id = nf.product_id
WHERE p.is_deprecated IS NOT TRUE
  AND (nf.calories < 0 OR nf.total_fat_g < 0 OR nf.saturated_fat_g < 0
    OR nf.trans_fat_g < 0 OR nf.carbs_g < 0 OR nf.sugars_g < 0
    OR nf.fibre_g < 0 OR nf.protein_g < 0 OR nf.salt_g < 0)) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 16. SAT FAT > TOTAL FAT
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '16. SAT FAT > TOTAL FAT' AS check_name, COUNT(*) AS violations
FROM (SELECT p.product_id, p.brand, p.product_name,
       'SAT FAT > TOTAL FAT' AS issue,
       CONCAT('sat_fat=', nf.saturated_fat_g, ' > total_fat=', nf.total_fat_g) AS detail
FROM qa_proven_nutrition nf
JOIN products p ON p.product_id = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['saturated_fat_g','total_fat_g'],NULL)
  AND p.is_deprecated IS NOT TRUE
  AND nf.saturated_fat_g > nf.total_fat_g
  AND nf.total_fat_g IS NOT NULL) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 17. SUGARS > CARBS
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '17. SUGARS > CARBS' AS check_name, COUNT(*) AS violations
FROM (SELECT p.product_id, p.brand, p.product_name,
       'SUGARS > CARBS' AS issue,
       CONCAT('sugars=', nf.sugars_g, ' > carbs=', nf.carbs_g) AS detail
FROM qa_proven_nutrition nf
JOIN products p ON p.product_id = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['sugars_g','carbs_g'],NULL)
  AND p.is_deprecated IS NOT TRUE
  AND nf.sugars_g > nf.carbs_g
  AND nf.carbs_g IS NOT NULL) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 18. CALORIES > 900
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '18. CALORIES > 900' AS check_name, COUNT(*) AS violations
FROM (SELECT p.product_id, p.brand, p.product_name,
       'CALORIES > 900' AS issue,
       CONCAT('calories=', nf.calories) AS detail
FROM qa_proven_nutrition nf
JOIN products p ON p.product_id = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['calories'])
  AND p.is_deprecated IS NOT TRUE
  AND nf.calories > 900) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 19. MISSING CANONICAL PROJECTION
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '19. MISSING CANONICAL PROJECTION' AS check_name, COUNT(*) AS violations
FROM (SELECT p.product_id,'MISSING CANONICAL PROJECTION' AS issue FROM public.products p LEFT JOIN qa_evidence_products q USING(product_id) WHERE p.is_deprecated IS NOT TRUE AND (q.model IS NULL OR q.model->>'product_id' IS DISTINCT FROM p.product_id::text)) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 20. CLASSIFICATION WITHOUT SOURCE
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '20. CLASSIFICATION WITHOUT SOURCE' AS check_name, COUNT(*) AS violations
FROM (SELECT product_id,key,'CLASSIFICATION WITHOUT SOURCE' AS issue FROM qa_classification_violations) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 21. V_MASTER ROW MISMATCH
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '21. V_MASTER ROW MISMATCH' AS check_name, COUNT(*) AS violations
FROM (SELECT
  'V_MASTER ROW MISMATCH' AS issue,
  (SELECT COUNT(*) FROM v_master) AS v_master_rows,
  (SELECT COUNT(*) FROM products WHERE is_deprecated IS NOT TRUE) AS active_products
WHERE (SELECT COUNT(*) FROM v_master) !=
      (SELECT COUNT(*) FROM products WHERE is_deprecated IS NOT TRUE)) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 22. (Removed — product_sources table eliminated in consolidation)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 23. ORPHAN INGREDIENT REF
--     Skipped when product_ingredient is empty (pipeline not yet built).
--     Also checks parent_ingredient_id references (sub-ingredient parents).
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '23. ORPHAN INGREDIENT REF' AS check_name, COUNT(*) AS violations
FROM (SELECT ir.ingredient_id, ir.name_en,
       'ORPHAN INGREDIENT REF' AS issue
FROM ingredient_ref ir
LEFT JOIN product_ingredient pi ON pi.ingredient_id = ir.ingredient_id
LEFT JOIN product_ingredient pi2 ON pi2.parent_ingredient_id = ir.ingredient_id
WHERE pi.ingredient_id IS NULL
  AND pi2.parent_ingredient_id IS NULL
  AND EXISTS (SELECT 1 FROM product_ingredient LIMIT 1)) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 24. INGREDIENT FK BROKEN
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '24. INGREDIENT FK BROKEN' AS check_name, COUNT(*) AS violations
FROM (SELECT pi.product_id, pi.ingredient_id, pi.position,
       'INGREDIENT FK BROKEN' AS issue
FROM product_ingredient pi
LEFT JOIN products p ON p.product_id = pi.product_id
WHERE p.product_id IS NULL) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 25. (Removed — ingredients table dropped in migration 20260211000600)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 26. ALLERGEN INFO FK BROKEN
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '26. ALLERGEN INFO FK BROKEN' AS check_name, COUNT(*) AS violations
FROM (SELECT ai.product_id, ai.tag, ai.type,
       'ALLERGEN INFO FK BROKEN' AS issue
FROM product_allergen_info ai
LEFT JOIN products p ON p.product_id = ai.product_id
WHERE p.product_id IS NULL) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 27. (Merged into #26 — product_trace eliminated, uses product_allergen_info)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 28. DUPLICATE INGREDIENT POSITION
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '28. DUPLICATE INGREDIENT POSITION' AS check_name, COUNT(*) AS violations
FROM (SELECT product_id, position, COUNT(*) AS dupes,
       'DUPLICATE INGREDIENT POSITION' AS issue
FROM product_ingredient
GROUP BY product_id, position
HAVING COUNT(*) > 1) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 29. SUB_INGREDIENT WITHOUT PARENT
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '29. SUB_INGREDIENT WITHOUT PARENT' AS check_name, COUNT(*) AS violations
FROM (SELECT pi.product_id, pi.ingredient_id, pi.position,
       'SUB_INGREDIENT WITHOUT PARENT' AS issue
FROM product_ingredient pi
WHERE pi.is_sub_ingredient = true
  AND pi.parent_ingredient_id IS NULL) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 30. CONCERN TIER OUT OF RANGE
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '30. CONCERN TIER OUT OF RANGE' AS check_name, COUNT(*) AS violations
FROM (SELECT ir.ingredient_id, ir.name_en, ir.concern_tier,
       'CONCERN TIER OUT OF RANGE' AS issue
FROM ingredient_ref ir
WHERE ir.concern_tier IS NOT NULL
  AND ir.concern_tier NOT IN (0, 1, 2, 3)) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 31. CONCERN SCORE OUT OF RANGE
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '31. CONCERN SCORE OUT OF RANGE' AS check_name, COUNT(*) AS violations
FROM (SELECT p.product_id, p.ingredient_concern_score,
       'CONCERN SCORE OUT OF RANGE' AS issue
FROM products p
WHERE p.ingredient_concern_score IS NOT NULL
  AND (p.ingredient_concern_score < 0 OR p.ingredient_concern_score > 100)) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 32. RETIRED CONCERN SCORE EXPOSED
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '32. RETIRED CONCERN SCORE EXPOSED' AS check_name, COUNT(*) AS violations
FROM (SELECT product_id,'RETIRED CONCERN SCORE EXPOSED' AS issue FROM qa_evidence_products WHERE model ? 'ingredient_concern_score') violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 33. MISSING SOURCE TYPE
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '33. MISSING SOURCE TYPE' AS check_name, COUNT(*) AS violations
FROM (SELECT p.product_id, p.brand, p.product_name,
       'MISSING SOURCE TYPE' AS issue
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND p.source_type IS NULL) violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 34. (Removed — product_sources table eliminated in consolidation)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 35. (Merged into #21 — identical v_master fan-out guard)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- Historical coverage/anomaly summaries moved to contracts/evidence_coverage.sql.
-- They are informational, never row-presence failures or verification quotas.
-- 42. product_images invalid URLs
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '42. product_images invalid URLs' AS check_name,
       COUNT(*) AS violations
FROM product_images
WHERE url NOT LIKE 'https://%';

-- ═══════════════════════════════════════════════════════════════════════════
-- 43. product_images multiple primaries
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '43. product_images multiple primaries' AS check_name,
       COUNT(*) AS violations
FROM (
    SELECT product_id, COUNT(*) AS primary_count
    FROM product_images
    WHERE is_primary = true
    GROUP BY product_id
    HAVING COUNT(*) > 1
) sub;
