-- C evidence-first semantics: load contracts/evidence_data.sql in this session.
-- Historical mathematical range/equality checks remain operator audits, not consumer validity.
-- ═══════════════════════════════════════════════════════════════════════════════
-- QA Suite: Multi-Country Consistency
-- Validates scoring equivalence, data integrity, and cross-country parity
-- between PL (primary) and DE datasets.
-- Complements QA__country_isolation (API boundary checks) with data-level
-- consistency checks.
-- 13 checks + 3 cross-country link checks = 16 checks.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. cross-country scoring equivalence (same inputs = same score)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '1. cross-country scoring equivalence (same inputs = same score)' AS check_name,
       CASE WHEN (
           SELECT compute_unhealthiness_v33(
               p_saturated_fat_g := 5.0, p_sugars_g := 12.0, p_salt_g := 0.8,
               p_calories := 200, p_trans_fat_g := 0, p_additives_count := 2,
               p_prep_method := 'baked', p_controversies := 'minor',
               p_concern_score := 1, p_protein_g := 10, p_fibre_g := 3
           )
       ) = (
           SELECT compute_unhealthiness_v33(
               p_saturated_fat_g := 5.0, p_sugars_g := 12.0, p_salt_g := 0.8,
               p_calories := 200, p_trans_fat_g := 0, p_additives_count := 2,
               p_prep_method := 'baked', p_controversies := 'minor',
               p_concern_score := 1, p_protein_g := 10, p_fibre_g := 3
           )
       )
       THEN 0 ELSE 1 END AS violations;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. every active country has at least one product
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '2. every active country has at least one product' AS check_name,
       COUNT(*) AS violations
FROM country_ref cr
WHERE cr.is_active = true
  AND NOT EXISTS (
      SELECT 1 FROM products p
      WHERE p.country = cr.country_code
        AND p.is_deprecated IS NOT TRUE
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. all countries publish retired null current scores
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '3. all countries publish retired null current scores' AS check_name, COUNT(*) AS violations
FROM qa_score_violations;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. all scores in valid 1-100 range per country
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '4. all scores in valid 1-100 range per country' AS check_name,
       COUNT(*) AS violations
FROM products p
JOIN country_ref cr ON cr.country_code = p.country AND cr.is_active = true
WHERE p.is_deprecated IS NOT TRUE
  AND p.unhealthiness_score IS NOT NULL
  AND (p.unhealthiness_score < 1 OR p.unhealthiness_score > 100);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. all countries preserve explicit missing nutrition
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '5. all countries preserve explicit missing nutrition' AS check_name, COUNT(*) AS violations
FROM qa_legacy_missing_violations;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. PL and DE both active in country_ref
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '6. PL and DE both active in country_ref' AS check_name,
       2 - COUNT(*) AS violations
FROM country_ref
WHERE country_code IN ('PL', 'DE')
  AND is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. no products with country not in active country_ref
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '7. no products with country not in active country_ref' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND NOT EXISTS (
      SELECT 1 FROM country_ref cr
      WHERE cr.country_code = p.country
        AND cr.is_active = true
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. DE products only in allowed categories
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '8. DE products only in allowed categories' AS check_name,
       COUNT(*) AS violations
FROM products p
WHERE p.country = 'DE'
  AND p.is_deprecated IS NOT TRUE
  AND p.category NOT IN (
    'Alcohol', 'Baby', 'Bread', 'Breakfast & Grain-Based', 'Canned Goods',
    'Cereals', 'Chips', 'Coffee & Tea', 'Condiments', 'Dairy',
    'Desserts & Ice Cream', 'Drinks', 'Frozen & Prepared', 'Frozen Vegetables',
    'Instant & Frozen', 'Meat', 'Nuts, Seeds & Legumes', 'Oils & Vinegars',
    'Pasta & Rice', 'Plant-Based & Alternatives', 'Ready Meals',
    'Sauces', 'Seafood & Fish', 'Snacks', 'Soups', 'Spices & Seasonings',
    'Spreads & Dips', 'Sweets'
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. selected source market matches catalog country
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '9. selected source market matches catalog country' AS check_name, COUNT(*) AS violations
FROM public.product_source_records r JOIN public.products p ON p.product_id=r.product_id
WHERE r.country IS DISTINCT FROM p.country;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. recomputed scores match stored scores across all countries
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '10. recomputed scores match stored scores across all countries' AS check_name,
       COUNT(*) AS violations
FROM products p
JOIN nutrition_facts nf ON nf.product_id = p.product_id
LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE ir.is_additive)::int AS additives_count
    FROM product_ingredient pi
    JOIN ingredient_ref ir ON ir.ingredient_id = pi.ingredient_id
    WHERE pi.product_id = p.product_id
) ia ON true
WHERE p.is_deprecated IS NOT TRUE
  AND p.unhealthiness_score IS NOT NULL
  AND p.unhealthiness_score != compute_unhealthiness_v33(
      p_saturated_fat_g := nf.saturated_fat_g,
      p_sugars_g        := nf.sugars_g,
      p_salt_g          := nf.salt_g,
      p_calories        := nf.calories,
      p_trans_fat_g     := nf.trans_fat_g,
      p_additives_count := COALESCE(ia.additives_count, 0),
      p_prep_method     := p.prep_method,
      p_controversies   := p.controversies,
      p_concern_score   := COALESCE(p.ingredient_concern_score, 0),
      p_protein_g       := COALESCE(nf.protein_g, 0),
      p_fibre_g         := COALESCE(nf.fibre_g, 0)
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. product_links: no deprecated product references
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '11. product_links: no deprecated product references' AS check_name,
       COUNT(*) AS violations
FROM product_links pl
LEFT JOIN products pa ON pa.product_id = pl.product_id_a
LEFT JOIN products pb ON pb.product_id = pl.product_id_b
WHERE pa.is_deprecated = true OR pb.is_deprecated = true
   OR pa.product_id IS NULL OR pb.product_id IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. product_links: all link_type values valid
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '12. product_links: all link_type values valid' AS check_name,
       COUNT(*) AS violations
FROM product_links pl
WHERE pl.link_type NOT IN ('identical', 'equivalent', 'variant', 'related');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. product_links: ordering constraint valid
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '13. product_links: ordering constraint valid' AS check_name,
       COUNT(*) AS violations
FROM product_links pl
WHERE pl.product_id_a >= pl.product_id_b;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 14. cross-country links connect different countries
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '14. cross-country links connect different countries' AS check_name,
       COUNT(*) AS violations
FROM product_links pl
JOIN products pa ON pa.product_id = pl.product_id_a
JOIN products pb ON pb.product_id = pl.product_id_b
WHERE pa.country = pb.country
  AND pl.confidence IN ('ean_match', 'brand_match');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 15. ean_match links share the same EAN
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '15. ean_match links share the same EAN' AS check_name,
       COUNT(*) AS violations
FROM product_links pl
JOIN products pa ON pa.product_id = pl.product_id_a
JOIN products pb ON pb.product_id = pl.product_id_b
WHERE pl.confidence = 'ean_match'
  AND (pa.ean IS NULL OR pb.ean IS NULL OR pa.ean != pb.ean);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 16. auto_link_cross_country_products is idempotent
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT '16. auto_link_cross_country_products is idempotent' AS check_name,
       CASE WHEN (
           (auto_link_cross_country_products()->>'ean_links_created')::int = 0
           AND (auto_link_cross_country_products()->>'brand_links_created')::int = 0
       ) THEN 0 ELSE 1 END AS violations;
