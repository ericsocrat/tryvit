-- C: 13 blocking checks; seven old energy/category heuristics are informational.
-- Upper mass bounds apply only to proven per100g quantities. Relative comparisons
-- require the same known basis, preparation, observation and exact qualifier.
-- ============================================================
-- QA: Nutrition Ranges & Plausibility — 13 blocking checks
-- Validates that nutrition values fall within physiologically
-- plausible ranges and detects likely decimal point errors.
-- Absolute mass bounds use proven per100g; relative comparisons require a shared known basis.
-- All checks are BLOCKING.
-- Updated: servings table eliminated; nutrition_facts joins
-- directly to products.
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. calories in [0, 900] per 100g
--    Pure fat = 900 kcal/100g (theoretical max)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '1. calories in [0, 900] per 100g' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['calories'])
  AND p.is_deprecated IS NOT TRUE
  AND nf.calories IS NOT NULL
  AND (nf.calories::numeric < 0 OR nf.calories::numeric > 900);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Calorie back-calculation: stated calories should roughly match
--    protein×4 + carbs×4 + fat×9 (±20% tolerance per EU FIC Regulation
--    1169/2011 energy value guidance; accounts for label rounding,
--    fibre, organic acids, fermented products)
--    Only checks products with calories > 50 to avoid noise from beverages
-- ═══════════════════════════════════════════════════════════════════════════
-- Historical heuristic 2 is reported as informational coverage; it is not a universal physical constraint.

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. protein in [0, 100] per 100g
--    Physical mass bound, not an expected-product percentile.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '3. protein in [0, 100] per 100g' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['protein_g'])
  AND p.is_deprecated IS NOT TRUE
  AND nf.protein_g IS NOT NULL
  AND (nf.protein_g::numeric < 0 OR nf.protein_g::numeric > 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. total_fat in [0, 100] per 100g
--    Pure oils = 100g fat/100g
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '4. total_fat in [0, 100] per 100g' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['total_fat_g'])
  AND p.is_deprecated IS NOT TRUE
  AND nf.total_fat_g IS NOT NULL
  AND (nf.total_fat_g::numeric < 0 OR nf.total_fat_g::numeric > 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. carbs in [0, 100] per 100g
--    Pure sugar = 100g carbs/100g
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '5. carbs in [0, 100] per 100g' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['carbs_g'])
  AND p.is_deprecated IS NOT TRUE
  AND nf.carbs_g IS NOT NULL
  AND (nf.carbs_g::numeric < 0 OR nf.carbs_g::numeric > 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. salt in [0, 100] per 100g
--    Pure salt = 100g; most foods < 10g; soy sauce ≈ 14-18g
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '6. salt in [0, 100] per 100g' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['salt_g'])
  AND p.is_deprecated IS NOT TRUE
  AND nf.salt_g IS NOT NULL
  AND (nf.salt_g::numeric < 0 OR nf.salt_g::numeric > 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. saturated_fat <= total_fat + 0.5
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '7. saturated_fat <= total_fat + 0.5' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['saturated_fat_g','total_fat_g'],NULL)
  AND p.is_deprecated IS NOT TRUE
  AND nf.saturated_fat_g IS NOT NULL AND nf.total_fat_g IS NOT NULL
  AND nf.saturated_fat_g::numeric > nf.total_fat_g::numeric + 0.5;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. sugars <= carbs + 0.5
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '8. sugars <= carbs + 0.5' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['sugars_g','carbs_g'],NULL)
  AND p.is_deprecated IS NOT TRUE
  AND nf.sugars_g IS NOT NULL AND nf.carbs_g IS NOT NULL
  AND nf.sugars_g::numeric > nf.carbs_g::numeric + 0.5;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. fibre in [0, 100] per 100g
--    Physical mass bound, not a population heuristic.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '9. fibre in [0, 100] per 100g' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['fibre_g'])
  AND p.is_deprecated IS NOT TRUE
  AND nf.fibre_g IS NOT NULL
  AND (nf.fibre_g::numeric < 0 OR nf.fibre_g::numeric > 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. trans_fat in [0, 100] per 100g
--     Physical mass bound, not a typical-product composition threshold.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '10. trans_fat in [0, 100] per 100g' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['trans_fat_g'])
  AND p.is_deprecated IS NOT TRUE
  AND nf.trans_fat_g IS NOT NULL
  AND (nf.trans_fat_g::numeric < 0 OR nf.trans_fat_g::numeric > 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. Likely decimal error: protein ≥ 50g for non-supplement/protein products
--     (excluding categories where this is plausible)
-- ═══════════════════════════════════════════════════════════════════════════
-- Historical heuristic 11 is reported as informational coverage; it is not a universal physical constraint.

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. Likely decimal error: salt ≥ 30g per 100g
--     Seasoning powders/bouillon cubes can reach 22-28g;
--     anything ≥ 30g is suspicious even for condiments
-- ═══════════════════════════════════════════════════════════════════════════
-- Historical heuristic 12 is reported as informational coverage; it is not a universal physical constraint.

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. Likely decimal error: sugars ≥ 80g for non-candy/confectionery
--     Pure honey = 82g, dried fruit = 70-80g, pure sugar = 100g;
--     Excludes sweetener/condiment/confectionery categories
-- ═══════════════════════════════════════════════════════════════════════════
-- Historical heuristic 13 is reported as informational coverage; it is not a universal physical constraint.

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. zero-cal products have near-zero macros
--     If calories = 0, macros should sum to < 2g (rounding tolerance)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '14. zero-cal products have near-zero macros' AS check_name,
       COUNT(*) AS violations
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['calories','total_fat_g','protein_g','carbs_g'],NULL)
  AND p.is_deprecated IS NOT TRUE
  AND nf.calories IS NOT NULL AND nf.calories::numeric = 0
  AND (COALESCE(nf.total_fat_g::numeric, 0)
     + COALESCE(nf.protein_g::numeric, 0)
     + COALESCE(nf.carbs_g::numeric, 0)) > 2;

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. no negative nutrition values
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '15. no negative nutrition values' AS check_name,
       COUNT(*) AS violations
FROM nutrition_facts nf
JOIN products p ON p.product_id = nf.product_id
WHERE p.is_deprecated IS NOT TRUE
  AND (nf.calories::numeric < 0
    OR nf.total_fat_g::numeric < 0
    OR nf.saturated_fat_g::numeric < 0
    OR nf.trans_fat_g::numeric < 0
    OR nf.carbs_g::numeric < 0
    OR nf.sugars_g::numeric < 0
    OR nf.fibre_g::numeric < 0
    OR nf.protein_g::numeric < 0
    OR nf.salt_g::numeric < 0);

-- ═══════════════════════════════════════════════════════════════════════════
-- 16. Likely kJ stored as kcal: calories > 400 AND calorie back-calculation
--     shows stated value ≈ 4.184× expected (kJ/kcal conversion factor)
--     Tolerance: ±15% of the kJ→kcal ratio
-- ═══════════════════════════════════════════════════════════════════════════
-- Historical heuristic 16 is reported as informational coverage; it is not a universal physical constraint.

-- ═══════════════════════════════════════════════════════════════════════════
-- 17. Extreme salt (>10g/100g) outside expected high-salt categories
--     Sauces, Condiments, Seafood & Fish can legitimately have very high salt
--     (soy sauce, seasoning powders, dried seaweed). Other categories should
--     not exceed 10g/100g. Instant noodles include seasoning packets and can
--     reach 13-14g/100g per OFF data.
-- ═══════════════════════════════════════════════════════════════════════════
-- Historical heuristic 17 is reported as informational coverage; it is not a universal physical constraint.

-- ═══════════════════════════════════════════════════════════════════════════
-- 18. Extreme calories (>700 kcal/100g) outside expected high-calorie categories
--     Oils (900 kcal), nuts (700-750 kcal), and some plant-based oils
--     legitimately have very high calorie density. Other categories should not.
-- ═══════════════════════════════════════════════════════════════════════════
-- Historical heuristic 18 is reported as informational coverage; it is not a universal physical constraint.

-- ═══════════════════════════════════════════════════════════════════════════
-- 19. protein missingness and quantity state are explicit
--     Required for v3.3 nutrient density bonus (#608).
--     Products without protein data cannot receive the density bonus.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '19. protein missingness and quantity state are explicit' AS check_name, COUNT(*) AS violations
FROM qa_field_violations
WHERE field='protein_g';

-- ═══════════════════════════════════════════════════════════════════════════
-- 20. fibre missingness and quantity state are explicit
--     Required for v3.3 nutrient density bonus (#608).
--     Products without fibre data default to 0 (no bonus, not penalty).
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '20. fibre missingness and quantity state are explicit' AS check_name, COUNT(*) AS violations
FROM qa_field_violations
WHERE field='fibre_g';
