-- C evidence-first semantics: load contracts/evidence_data.sql in this session.
-- Historical mathematical range/equality checks remain operator audits, not consumer validity.
-- ============================================================
-- QA: Data Quality & Plausibility Checks (31 blocking checks)
-- Validates data hygiene, plausibility bounds, cross-field
-- consistency, and coverage regression thresholds.
-- All checks are BLOCKING unless marked informational.
-- Updated: scores merged into products; servings eliminated;
-- product_sources merged into products.
-- Coverage thresholds added (#717).
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. trans_fat <= total_fat
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '1. trans_fat <= total_fat' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['trans_fat_g','total_fat_g'],NULL)
  AND p.is_deprecated IS NOT TRUE
  AND nf.trans_fat_g IS NOT NULL
  AND nf.total_fat_g IS NOT NULL
  AND nf.trans_fat_g > nf.total_fat_g;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. total macros <= 105g per 100g
--    (pure oils like coconut oil can reach ~101g; 105g adds safety margin)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '2. total macros <= 105g per 100g' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['total_fat_g','carbs_g','protein_g'])
  AND p.is_deprecated IS NOT TRUE
  AND (COALESCE(nf.total_fat_g, 0) + COALESCE(nf.carbs_g, 0)
     + COALESCE(nf.protein_g, 0)) > 105;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. proven per100g mass fields do not exceed100g
--    fat/carbs/protein ≤ 100g each, salt ≤ 40g
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '3. proven per100g mass fields do not exceed100g' AS check_name, COUNT(*) AS violations
FROM qa_evidence_products p CROSS JOIN LATERAL jsonb_each(p.model->'nutrition') f
WHERE f.key IN ('total_fat_g','carbs_g','protein_g','salt_g','fibre_g') AND pg_temp.qa_fields_comparable(p.model,ARRAY[f.key]) AND (f.value->>'value')::numeric>100;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. no empty strings in key fields
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '4. no empty strings in key fields' AS check_name,
       COUNT(*) AS violations
FROM (
    SELECT product_id FROM products WHERE ean = ''
    UNION ALL
    SELECT product_id FROM products WHERE brand = ''
) q;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. no untrimmed names/brands
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '5. no untrimmed names/brands' AS check_name,
       COUNT(*) AS violations
FROM products
WHERE product_name != TRIM(product_name)
   OR brand != TRIM(brand);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. EAN format (8 or 13 digits)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '6. EAN format (8 or 13 digits)' AS check_name,
       COUNT(*) AS violations
FROM products
WHERE ean IS NOT NULL
  AND ean !~ '^[0-9]{8}$'
  AND ean !~ '^[0-9]{13}$';

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. (removed — scored_at column dropped)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. deprecated products flagged correctly
--    For now: deprecated products should have is_deprecated = true explicitly
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '8. deprecated products flagged correctly' AS check_name,
       COUNT(*) AS violations
FROM products
WHERE is_deprecated = true
  AND category IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. (removed — servings table eliminated in consolidation)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. NOVA is absent or backed by selected source evidence
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '10. NOVA is absent or backed by selected source evidence' AS check_name, COUNT(*) AS violations
FROM qa_classification_violations
WHERE key='nova';

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. (removed — processing_risk column dropped; now derived in v_master)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. (removed — servings table eliminated in consolidation)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. sat_fat <= total_fat (all nutrition)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '13. sat_fat <= total_fat (all nutrition)' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['saturated_fat_g','total_fat_g'],NULL)
  AND nf.saturated_fat_g IS NOT NULL
  AND nf.total_fat_g IS NOT NULL
  AND nf.saturated_fat_g > nf.total_fat_g;

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. sugars <= carbs (all nutrition)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '14. sugars <= carbs (all nutrition)' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['sugars_g','carbs_g'],NULL)
  AND nf.sugars_g IS NOT NULL
  AND nf.carbs_g IS NOT NULL
  AND nf.sugars_g > nf.carbs_g;

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. (removed — per-serving proportionality check; servings table eliminated)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 16. score_breakdown final_score matches stored score
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '16. score_breakdown final_score matches stored score' AS check_name,
       COUNT(*) AS violations
FROM v_master
WHERE score_breakdown IS NOT NULL
  AND (score_breakdown->>'final_score')::int != unhealthiness_score;

-- ═══════════════════════════════════════════════════════════════════════════
-- 17. (removed — scoring_version column dropped)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 18. materialized views not stale
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '18. materialized views not stale' AS check_name,
       COUNT(*) AS violations
FROM (
    SELECT mv_staleness_check() AS staleness
) s
WHERE (s.staleness->>'is_stale')::boolean = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 19. missing historical nutrition stays explicit
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '19. missing historical nutrition stays explicit' AS check_name, COUNT(*) AS violations
FROM qa_legacy_missing_violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 20. (removed — product_sources table merged into products in consolidation)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 21. data_completeness_pct in valid range
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '21. data_completeness_pct in valid range' AS check_name,
       COUNT(*) AS violations
FROM products
WHERE data_completeness_pct IS NOT NULL
  AND (data_completeness_pct < 0 OR data_completeness_pct > 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- 22. ingredient_data_quality valid enum
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '22. ingredient_data_quality valid enum' AS check_name,
       COUNT(*) AS violations
FROM v_master
WHERE ingredient_data_quality NOT IN ('complete', 'partial', 'missing');

-- ═══════════════════════════════════════════════════════════════════════════
-- 23. nutrition_data_quality valid enum
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '23. nutrition_data_quality valid enum' AS check_name,
       COUNT(*) AS violations
FROM v_master
WHERE nutrition_data_quality NOT IN ('clean', 'suspect');

-- ═══════════════════════════════════════════════════════════════════════════
-- 24. nutrition preparation state is explicit
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '24. nutrition preparation state is explicit' AS check_name, COUNT(*) AS violations
FROM qa_evidence_fields
WHERE body->>'preparation_state' IS NULL OR body->>'preparation_state' NOT IN ('as_sold','prepared','unknown');

-- ═══════════════════════════════════════════════════════════════════════════
-- 25. product_ingredient FK to ingredient_ref
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '25. product_ingredient FK to ingredient_ref' AS check_name,
       COUNT(*) AS violations
FROM product_ingredient pi
LEFT JOIN ingredient_ref ir ON ir.ingredient_id = pi.ingredient_id
WHERE ir.ingredient_id IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 26. (removed — product_sources.collected_at eliminated in consolidation)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 27. product_type not null for active products
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '27. product_type not null for active products' AS check_name,
       COUNT(*) AS violations
FROM products
WHERE is_deprecated IS NOT TRUE
  AND product_type IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 28. concern_reason populated for tier 1-3 ingredients
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '28. concern_reason populated for tier 1-3 ingredients' AS check_name,
       COUNT(*) AS violations
FROM ingredient_ref
WHERE concern_tier >= 1
  AND (concern_reason IS NULL OR concern_reason = '');

-- ═══════════════════════════════════════════════════════════════════════════
-- 29. daily_value_ref EU RI completeness
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '29. daily_value_ref EU RI completeness' AS check_name,
       9 - COUNT(*) AS violations
FROM daily_value_ref
WHERE regulation = 'eu_ri';

-- ═══════════════════════════════════════════════════════════════════════════
-- 30. daily_value_ref positive values
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '30. daily_value_ref positive values' AS check_name,
       COUNT(*) AS violations
FROM daily_value_ref
WHERE daily_value <= 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- 31. product_images HTTPS URLs
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '31. product_images HTTPS URLs' AS check_name,
       COUNT(*) AS violations
FROM product_images
WHERE url IS NOT NULL
  AND url NOT LIKE 'https://%';

-- ═══════════════════════════════════════════════════════════════════════════
-- 32. v_master image_thumb_url HTTPS
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '32. v_master image_thumb_url HTTPS' AS check_name,
       COUNT(*) AS violations
FROM v_master
WHERE image_thumb_url IS NOT NULL
  AND image_thumb_url NOT LIKE 'https://%';

-- ═══════════════════════════════════════════════════════════════════════════
-- 33. product_images single primary per product
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '33. product_images single primary per product' AS check_name,
       COUNT(*) AS violations
FROM (
  SELECT product_id
  FROM product_images
  WHERE is_primary = true
  GROUP BY product_id
  HAVING COUNT(*) > 1
) dups;

-- ═══════════════════════════════════════════════════════════════════════════
-- 34. recorded ingredient assertions link to accepted product observations
--     Thresholds: PL ≥ 12%, DE ≥ 2% (aligned to OFF API data availability at 10K scale)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '34. recorded ingredient assertions link to accepted product observations' AS check_name, COUNT(*) AS violations
FROM qa_evidence_products p CROSS JOIN LATERAL jsonb_array_elements(p.model->'ingredients'->'items') a
WHERE a->>'state'='recorded' AND NOT EXISTS(SELECT 1 FROM public.product_source_records r JOIN public.product_source_observations o ON o.id=r.selected_observation_id WHERE r.product_id=p.product_id AND o.status='accepted' AND o.id::text=a->>'observation_id');

-- ═══════════════════════════════════════════════════════════════════════════
-- 35. recorded allergen assertions link to accepted product observations
--     Thresholds: PL ≥ 8%, DE ≥ 2% (aligned to OFF API data availability at 10K scale)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '35. recorded allergen assertions link to accepted product observations' AS check_name, COUNT(*) AS violations
FROM qa_evidence_products p CROSS JOIN LATERAL jsonb_array_elements((p.model->'allergens'->'contains')||(p.model->'allergens'->'traces')) a
WHERE a->>'state'='recorded' AND NOT EXISTS(SELECT 1 FROM public.product_source_records r JOIN public.product_source_observations o ON o.id=r.selected_observation_id WHERE r.product_id=p.product_id AND o.status='accepted' AND o.id::text=a->>'observation_id');

-- ═══════════════════════════════════════════════════════════════════════════
-- 36. projection preserves known and missing EAN without fabrication
--     Threshold: ≥ 99% for all countries
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '36. projection preserves known and missing EAN without fabrication' AS check_name, COUNT(*) AS violations
FROM qa_evidence_products q JOIN public.products p USING(product_id)
WHERE q.model->>'ean' IS DISTINCT FROM p.ean;

-- ═══════════════════════════════════════════════════════════════════════════
-- 37. recorded field count equals actual published evidence
--     Threshold: PL ≥ 80%, DE ≥ 75% (relaxed for 10K expansion — pre-enrichment)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '37. recorded field count equals actual published evidence' AS check_name, COUNT(*) AS violations
FROM qa_evidence_count_violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 38. same-country cross-category EAN duplicates
--     The same EAN must not appear in more than one active product.
--     (Detects cross-category collisions that the pipeline should prevent.)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '38. same-country cross-category EAN duplicates' AS check_name, COUNT(*) AS violations
FROM (SELECT country,ean FROM products WHERE ean IS NOT NULL AND is_deprecated IS NOT TRUE
GROUP BY country,ean HAVING COUNT(DISTINCT category)>1) duplicates;

-- ═══════════════════════════════════════════════════════════════════════════
-- 39. Fuzzy brand variants (normalize_brand collision)
--     Brands that normalize to the same canonical form but differ in raw
--     spelling indicate data-entry inconsistencies (e.g. "Dr.Oetker" vs
--     "Dr. Oetker").  Informational — helps drive brand_alias curation.
-- ═══════════════════════════════════════════════════════════════════════════
-- Fuzzy brand variants are informational in contracts/evidence_coverage.sql.

-- ═══════════════════════════════════════════════════════════════════════════
-- 40. no active QA fixture products
--     QA fixtures (brand = 'QA Test Brand') are synthetic Dairy products
--     seeded by frontend/tests/quality/seed-fixtures.mjs for Playwright
--     quality-gate runs. They must ONLY exist on a staging/test instance.
--     In June 2026 four leaked into production because the CI seed step fell
--     back to the production URL when the staging secret was unset. This
--     check fails if any such product is active (is_deprecated IS NOT TRUE),
--     guaranteeing fixtures never surface in any user-facing surface again.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '40. no active QA fixture products' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.brand = 'QA Test Brand'
  AND p.is_deprecated IS NOT TRUE;
