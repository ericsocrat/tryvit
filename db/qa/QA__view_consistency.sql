BEGIN;
CREATE FUNCTION pg_temp.qa_ok(condition boolean) RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN condition IS TRUE THEN 0 ELSE 1 END; $$;
-- ============================================================
-- QA: View & Function Consistency
-- Validates that materialized views, API functions, and
-- computed columns are internally consistent with base tables.
-- All checks are BLOCKING.
-- Updated: scores merged into products; product_allergen and
-- product_trace merged into product_allergen_info.
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. v_product_confidence row count matches v_master
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '1. v_product_confidence rows = v_master rows' AS check_name,
       COUNT(*) AS violations
FROM (
    SELECT (SELECT COUNT(*) FROM v_product_confidence) AS conf_count,
           (SELECT COUNT(*) FROM v_master) AS master_count
) sub
WHERE conf_count != master_count;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. v_api_category_overview categories match category_ref active categories
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '2. retained category overviews have complete categories and consistent totals' AS check_name,
       COUNT(*) AS violations
FROM (
    SELECT (SELECT COUNT(*) FROM v_api_category_overview) AS api_cats,
           (SELECT COUNT(*) FROM category_ref WHERE is_active = true) AS ref_cats,
           (SELECT COALESCE(SUM(product_count),0) FROM v_api_category_overview) AS global_products,
           (SELECT COALESCE(SUM(product_count),0) FROM v_api_category_overview_by_country) AS country_products,
           (SELECT COUNT(*) FROM v_master) AS active_products
) sub
WHERE api_cats != ref_cats OR global_products != active_products OR country_products != global_products;

SELECT '3. score explanation is refresh-only' AS check_name, pg_temp.qa_ok(public.api_score_explanation(-1)->>'error'='refresh_required') AS violations;
SELECT '4. score explanation exposes no derived payload' AS check_name, pg_temp.qa_ok(NOT(public.api_score_explanation(-1) ?| ARRAY['score_breakdown','summary','top_factors','product_id'])) AS violations;
SELECT '5. retired detail has no health confidence payload' AS check_name, pg_temp.qa_ok(public.api_product_detail(-1)->>'error'='refresh_required' AND NOT(public.api_product_detail(-1) ? 'trust')) AS violations;
SELECT '6. canonical nutrition preserves field structure' AS check_name,COUNT(*) AS violations
FROM public.products p CROSS JOIN LATERAL evidence_private.product_one(p.product_id,'en') m
WHERE p.is_deprecated IS NOT TRUE AND (jsonb_typeof(m->'nutrition') IS DISTINCT FROM 'object'
 OR (SELECT count(*) FROM jsonb_each(m->'nutrition'))<>9
 OR EXISTS(SELECT 1 FROM jsonb_each(m->'nutrition') f WHERE NOT(f.value ?& ARRAY['value','state','basis','unit','preparation_state','observation_id','qualifier'])));

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. v_master score_breakdown factors count = 10 (9 penalties + 1 bonus, v3.3)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '7. score_breakdown has 10 factors' AS check_name,
       COUNT(*) AS violations
FROM v_master
WHERE score_breakdown IS NOT NULL
  AND jsonb_array_length(score_breakdown->'factors') != 10;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. v_master ingredient_count matches product_ingredient junction table
--    ingredient_count includes all rows (top-level + sub-ingredients)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '8. v_master ingredient_count accurate' AS check_name,
       COUNT(*) AS violations
FROM v_master m
LEFT JOIN (
    SELECT product_id, COUNT(*) AS cnt
    FROM product_ingredient
    GROUP BY product_id
) pi ON pi.product_id = m.product_id
WHERE COALESCE(m.ingredient_count, 0) != COALESCE(pi.cnt, 0);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. v_master allergen_count matches product_allergen_info (type='contains')
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '9. v_master allergen_count accurate' AS check_name,
       COUNT(*) AS violations
FROM v_master m
LEFT JOIN (
    SELECT product_id, COUNT(DISTINCT tag) AS cnt
    FROM product_allergen_info
    WHERE type = 'contains'
    GROUP BY product_id
) pai ON pai.product_id = m.product_id
WHERE COALESCE(m.allergen_count, 0) != COALESCE(pai.cnt, 0);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. v_master trace_count matches product_allergen_info (type='traces')
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '10. v_master trace_count accurate' AS check_name,
       COUNT(*) AS violations
FROM v_master m
LEFT JOIN (
    SELECT product_id, COUNT(DISTINCT tag) AS cnt
    FROM product_allergen_info
    WHERE type = 'traces'
    GROUP BY product_id
) pai ON pai.product_id = m.product_id
WHERE COALESCE(m.trace_count, 0) != COALESCE(pai.cnt, 0);

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. mv_ingredient_frequency row count = used ingredient_ref count
--     MV uses INNER JOIN to product_ingredient + non-deprecated products,
--     so unused ingredients are excluded by design.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '11. mv_ingredient_frequency row count matches used ingredients' AS check_name,
       ABS(
         (SELECT COUNT(*) FROM mv_ingredient_frequency) -
         (SELECT COUNT(DISTINCT ir.ingredient_id)
          FROM ingredient_ref ir
          JOIN product_ingredient pi ON pi.ingredient_id = ir.ingredient_id
          JOIN products p ON p.product_id = pi.product_id AND p.is_deprecated IS NOT TRUE)
       ) AS violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. mv_ingredient_frequency product_count accuracy (spot-check top-5)
--     For each of the 5 most-used ingredients, the MV count should match
--     the actual product_ingredient count.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '12. mv_ingredient_frequency counts accurate' AS check_name,
       COUNT(*) AS violations
FROM (
  SELECT mv.ingredient_id, mv.product_count,
         (SELECT COUNT(DISTINCT pi.product_id)
          FROM product_ingredient pi
          JOIN products p ON p.product_id = pi.product_id AND p.is_deprecated IS NOT TRUE
          WHERE pi.ingredient_id = mv.ingredient_id) AS actual
  FROM mv_ingredient_frequency mv
  ORDER BY mv.product_count DESC
  LIMIT 5
) x
WHERE x.product_count <> x.actual;

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. v_master column count matches expected (drift detection)
--     v_master should have exactly 55 columns.  If a migration adds or
--     removes columns without updating the reference, this catches it.
--     Original 47 + 5 from localization phases 2 & 4:
--       product_name_en, product_name_en_source, created_at, updated_at, name_translations
--     + 3 from 2026-02-22 migrations:
--       image_thumb_url, vegan_contradiction, vegetarian_contradiction
--     + 1 from #353: nutri_score_source
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '13. v_master has expected column count (58)' AS check_name,
       ABS(58 - COUNT(*)) AS violations
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'v_master';

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. v_cross_country_scan_analytics view exists and has 7 columns
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '14. v_cross_country_scan_analytics has 7 columns' AS check_name,
       ABS(7 - COUNT(*)) AS violations
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'v_cross_country_scan_analytics';

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. v_cross_country_ean_candidates view exists and has 6 columns
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '15. v_cross_country_ean_candidates has 6 columns' AS check_name,
       ABS(6 - COUNT(*)) AS violations
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'v_cross_country_ean_candidates';

-- ═══════════════════════════════════════════════════════════════════════════
-- 16. v_submission_country_analytics view exists and has 7 columns
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '16. v_submission_country_analytics has 7 columns' AS check_name,
       ABS(7 - COUNT(*)) AS violations
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'v_submission_country_analytics';

ROLLBACK;
