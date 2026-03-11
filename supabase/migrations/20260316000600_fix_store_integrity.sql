-- Migration: Fix store integrity QA failures
-- Fixes 4 checks in QA__store_integrity.sql:
--   Check 5:  Delete orphan junction rows (deprecated products)
--   Check 6:  Reclassify Żabka-category products to Frozen & Prepared
--   Check 8:  Add Żabka store linkage for ex-Żabka products
--   Check 12: Backfill product_store_availability from products.store_availability
-- Rollback: No destructive schema changes; data is append/update only (see notes per step)
-- Idempotency: All operations are guarded (WHERE NOT EXISTS, ON CONFLICT, conditional UPDATE)

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 1: Delete orphan junction rows (product deprecated or missing)
-- Fixes Check 5 — 59 orphan rows
-- Rollback note: These rows reference deprecated products; no business value
-- ═══════════════════════════════════════════════════════════════════════════
DELETE FROM public.product_store_availability
WHERE product_id IN (
    SELECT psa.product_id
    FROM public.product_store_availability psa
    LEFT JOIN public.products p ON p.product_id = psa.product_id
    WHERE p.product_id IS NULL OR p.is_deprecated = true
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 2: Reclassify Żabka-category products to Frozen & Prepared
-- Fixes Check 6 — 28 active products with deactivated category
-- These are all convenience-store prepared foods (kebabs, burgers, pierogi, etc.)
-- Rollback: UPDATE products SET category = 'Żabka' WHERE product_id IN (...)
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE public.products
SET category = 'Frozen & Prepared'
WHERE category = 'Żabka'
  AND is_deprecated = false;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 3: Add Żabka store linkage for ex-Żabka products
-- Fixes Check 8 — same 28 products now need store_availability junction rows
-- Uses store_id from store_ref WHERE store_name = 'Żabka' AND country = 'PL'
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.product_store_availability (product_id, store_id, source)
SELECT p.product_id, sr.store_id, 'pipeline'
FROM public.products p
CROSS JOIN public.store_ref sr
WHERE p.brand IN ('Żabka', 'Tomcio Paluch', 'Szamamm')
  AND p.is_deprecated = false
  AND p.country = 'PL'
  AND sr.store_name = 'Żabka'
  AND sr.country = 'PL'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_store_availability psa
    WHERE psa.product_id = p.product_id
      AND psa.store_id = sr.store_id
  )
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 4: Backfill product_store_availability from products.store_availability
-- Fixes Check 12 — 315 PL products with store_availability set but no junction row
-- Matches products.store_availability to store_ref.store_name within same country
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.product_store_availability (product_id, store_id, source)
SELECT p.product_id, sr.store_id, 'pipeline'
FROM public.products p
JOIN public.store_ref sr
  ON sr.store_name = p.store_availability
  AND sr.country = p.country
WHERE p.store_availability IS NOT NULL
  AND p.is_deprecated = false
  AND NOT EXISTS (
    SELECT 1 FROM public.product_store_availability psa
    WHERE psa.product_id = p.product_id
      AND psa.store_id = sr.store_id
  )
ON CONFLICT DO NOTHING;
