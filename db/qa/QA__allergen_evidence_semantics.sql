-- ═══════════════════════════════════════════════════════════════════════════════
-- QA Suite: Phase 5 allergen evidence semantics
-- Positive rows have explicit provenance; missing rows remain unknown.
-- 7 checks.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Every positive evidence row has a supported non-null basis.
SELECT '1. allergen evidence basis is valid' AS check_name,
       COUNT(*) AS violations
FROM product_allergen_info
WHERE evidence_basis IS NULL
   OR evidence_basis NOT IN (
       'explicit_source',
       'ingredient_derived',
       'legacy_unclassified'
   );

-- 2. Explicit source evidence must retain source traceability.
SELECT '2. explicit allergen evidence retains source tag' AS check_name,
       COUNT(*) AS violations
FROM product_allergen_info
WHERE evidence_basis = 'explicit_source'
  AND source_tag IS NULL;

-- 3. Deterministic ingredient rules may establish contains evidence only.
SELECT '3. ingredient-derived evidence is contains-only' AS check_name,
       COUNT(*) AS violations
FROM product_allergen_info
WHERE evidence_basis = 'ingredient_derived'
  AND type <> 'contains';

-- 4. A representative product with no positive rows reports unknown.
WITH sample AS (
    SELECT p.product_id
    FROM products p
    WHERE p.is_deprecated IS NOT TRUE
      AND NOT EXISTS (
          SELECT 1
          FROM product_allergen_info ai
          WHERE ai.product_id = p.product_id
      )
    ORDER BY p.product_id
    LIMIT 1
)
SELECT '4. no evidence reports unknown in product profile' AS check_name,
       COUNT(*) AS violations
FROM sample
WHERE api_get_product_profile(sample.product_id)
          ->'allergens'->>'evidence_status' <> 'unknown';

-- 5. Product profiles never synthesize assessed absence in this contract.
WITH samples AS (
    SELECT p.product_id
    FROM products p
    WHERE p.is_deprecated IS NOT TRUE
    ORDER BY p.product_id
    LIMIT 25
)
SELECT '5. product profiles do not synthesize assessed absence' AS check_name,
       COUNT(*) AS violations
FROM samples
WHERE api_get_product_profile(samples.product_id)
          ->'allergens'->>'absence_assessment' <> 'not_assessed'
   OR jsonb_array_length(
          api_get_product_profile(samples.product_id)
              ->'allergens'->'assessed_absent'
      ) <> 0;

-- 6. The batch API returns explicit unknown payloads for requested products.
WITH sample AS (
    SELECT p.product_id
    FROM products p
    WHERE p.is_deprecated IS NOT TRUE
      AND NOT EXISTS (
          SELECT 1
          FROM product_allergen_info ai
          WHERE ai.product_id = p.product_id
      )
    ORDER BY p.product_id
    LIMIT 1
), response AS (
    SELECT sample.product_id,
           api_get_product_allergens(ARRAY[sample.product_id]) AS payload
    FROM sample
)
SELECT '6. batch allergen API names missing evidence unknown' AS check_name,
       COUNT(*) AS violations
FROM response
WHERE payload->(product_id::text)->>'evidence_status' <> 'unknown'
   OR jsonb_array_length(payload->(product_id::text)->'evidence') <> 0;

-- 7. The retained wire key is documented as exclusion, not absence proof.
SELECT '7. legacy search key has truthful semantic contract' AS check_name,
       CASE
           WHEN COALESCE(
               obj_description(
                   'public.api_search_products(text,jsonb,integer,integer,boolean)'
                       ::regprocedure,
                   'pg_proc'
               ),
               ''
           ) ILIKE '%exclude products with matching contains evidence%'
            AND COALESCE(
               obj_description(
                   'public.api_search_products(text,jsonb,integer,integer,boolean)'
                       ::regprocedure,
                   'pg_proc'
               ),
               ''
           ) ILIKE '%does not prove allergen absence%'
           THEN 0
           ELSE 1
       END AS violations;
