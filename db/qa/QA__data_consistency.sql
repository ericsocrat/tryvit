-- C evidence-first semantics: load contracts/evidence_data.sql in this session.
-- Historical mathematical range/equality checks remain operator audits, not consumer validity.
-- ============================================================
-- QA: Data Consistency & Standardisation
-- Cross-references domain values, detects orphaned / duplicate
-- records, and validates field domain constraints that don't
-- fit the other QA suites.
-- All checks are BLOCKING.
-- Updated: scores merged into products; servings eliminated;
-- product_sources merged into products.
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. no case-insensitive duplicate products
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '1. no case-insensitive duplicate products' AS check_name,
       COUNT(*) AS violations
FROM (
  SELECT 1
  FROM products p1
  JOIN products p2
    ON p1.country = p2.country
   AND p1.brand = p2.brand
   AND p1.product_id < p2.product_id
   AND lower(trim(p1.product_name)) = lower(trim(p2.product_name))
  WHERE p1.is_deprecated IS NOT TRUE
    AND p2.is_deprecated IS NOT TRUE
) x;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. nutri_score_label in valid domain
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '2. nutri_score_label in valid domain' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND p.nutri_score_label NOT IN ('A','B','C','D','E','NOT-APPLICABLE','UNKNOWN');

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. nova_classification in {1,2,3,4}
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '3. nova_classification in {1,2,3,4}' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND p.nova_classification::int NOT IN (1, 2, 3, 4);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. unhealthiness_score in [1, 100]
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '4. unhealthiness_score in [1, 100]' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND (p.unhealthiness_score::numeric < 1 OR p.unhealthiness_score::numeric > 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. data_completeness_pct in [0, 100]
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '5. data_completeness_pct in [0, 100]' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND (p.data_completeness_pct::numeric < 0 OR p.data_completeness_pct::numeric > 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ingredient_concern_score in [0, 100]
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '6. ingredient_concern_score in [0, 100]' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND (p.ingredient_concern_score::numeric < 0 OR p.ingredient_concern_score::numeric > 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. consumer projection omits retired score flags
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '7. consumer projection omits retired score flags' AS check_name, COUNT(*) AS violations
FROM qa_evidence_products
WHERE model ?| ARRAY['high_salt_flag','high_sugar_flag','high_sat_fat_flag','high_additive_load'];

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. product_type in product_type_ref
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '8. product_type in product_type_ref' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND p.product_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM product_type_ref ptr
    WHERE ptr.product_type = p.product_type
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. prep_method in valid domain
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '9. prep_method in valid domain' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND p.prep_method NOT IN (
    'air-popped', 'baked', 'fried', 'deep-fried', 'grilled', 'roasted',
    'smoked', 'steamed', 'marinated', 'pasteurized', 'fermented',
    'dried', 'raw', 'none', 'not-applicable'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. every active product publishes retired null score
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '10. every active product publishes retired null score' AS check_name, COUNT(*) AS violations
FROM qa_score_violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. nutrition evidence fields are complete and explicit
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '11. nutrition evidence fields are complete and explicit' AS check_name, COUNT(*) AS violations
FROM qa_evidence_count_violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. missing legacy quantities are not invented
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '12. missing legacy quantities are not invented' AS check_name, COUNT(*) AS violations
FROM qa_legacy_missing_violations;

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. every product has a source_type
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '13. every product has a source_type' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND p.source_type IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. country is 2-letter ISO code
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '14. country is 2-letter ISO code' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND (p.country IS NULL OR p.country !~ '^[A-Z]{2}$');

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. deprecated products have a reason
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '15. deprecated products have a reason' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS TRUE
  AND (p.deprecated_reason IS NULL OR trim(p.deprecated_reason) = '');

-- ═══════════════════════════════════════════════════════════════════════════
-- 16. no orphan nutrition_facts rows
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '16. no orphan nutrition_facts rows' AS check_name,
       COUNT(*) AS violations
FROM nutrition_facts nf
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.product_id = nf.product_id
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 17. (removed — servings table eliminated in consolidation)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 18. (removed — scores table merged into products in consolidation)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 19. data_completeness_pct matches dynamic computation
--     Detects drift between stored value and compute_data_completeness()
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '19. data_completeness_pct matches dynamic computation' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND p.data_completeness_pct != compute_data_completeness(p.product_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 20. confidence matches assign_confidence()
--     Verifies assign_confidence() output matches stored confidence
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '20. confidence matches assign_confidence()' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND p.confidence != assign_confidence(p.data_completeness_pct, p.source_type);

-- ═══════════════════════════════════════════════════════════════════════════
-- 21. nutri_score_source in valid domain
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '21. nutri_score_source in valid domain' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND p.nutri_score_source IS NOT NULL
  AND p.nutri_score_source NOT IN ('official_label', 'off_computed', 'manual', 'unknown');

-- ═══════════════════════════════════════════════════════════════════════════
-- 22. scored products have nutri_score_source
--     Products with an actual Nutri-Score grade (A-E) must have a source set.
--     NOT-APPLICABLE and UNKNOWN/NULL are excluded.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '22. scored products have nutri_score_source' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND p.nutri_score_label IN ('A', 'B', 'C', 'D', 'E')
  AND p.nutri_score_source IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 23. every category has product types
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '23. every category has product types' AS check_name,
       COUNT(*) AS violations
FROM category_ref cr
WHERE cr.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM product_type_ref ptr
    WHERE ptr.category = cr.category
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 24. every category has other fallback type
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '24. every category has other fallback type' AS check_name,
       COUNT(*) AS violations
FROM category_ref cr
WHERE cr.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM product_type_ref ptr
    WHERE ptr.category = cr.category
      AND ptr.product_type LIKE 'other-%'
  )
  AND cr.category NOT IN ('Chips', 'Żabka');
  -- Chips has legacy 'Grocery', Żabka has legacy 'Ready-to-eat' + 'other-zabka'

-- ═══════════════════════════════════════════════════════════════════════════
-- 25. all product brands in brand_ref
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '25. all product brands in brand_ref' AS check_name,
       COUNT(*) AS violations
FROM (
    SELECT DISTINCT p.brand
    FROM products p
    WHERE p.is_deprecated IS NOT TRUE
      AND p.brand IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM brand_ref br
        WHERE br.brand_name = p.brand
      )
) orphan_brands;

-- ═══════════════════════════════════════════════════════════════════════════
-- 26. no case-duplicate brand names
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '26. no case-duplicate brand names' AS check_name,
       COUNT(*) AS violations
FROM (
    SELECT LOWER(brand_name) AS lower_name
    FROM brand_ref
    GROUP BY LOWER(brand_name)
    HAVING COUNT(*) > 1
) case_dupes;
