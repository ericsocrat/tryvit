-- Restore truthful product selection in api_record_scan after
-- 20260321000500_country_scoped_submission_uniqueness.sql replaced the RPC and
-- unintentionally removed the active-product filter, region preference, and
-- is_cross_country response field introduced by 20260321000200.
--
-- This migration intentionally preserves:
--   * the existing (text, text) signature and caller grants;
--   * authenticated scan-history writes and rate limiting;
--   * country-scoped pending-submission lookup from 20260321000500.

CREATE OR REPLACE FUNCTION public.api_record_scan(
  p_ean          text,
  p_scan_country text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_product       record;
  v_found         boolean := false;
  v_product_id    bigint;
  v_language      text;
  v_country_lang  text;
  v_cat_display   text;
  v_cat_icon      text;
  v_rate_check    jsonb;
  v_scan_country  text;
BEGIN
  -- Validate EAN format.
  IF p_ean IS NULL OR LENGTH(TRIM(p_ean)) NOT IN (8, 13) THEN
    RETURN jsonb_build_object(
      'api_version', '1.0',
      'error',       'EAN must be 8 or 13 digits'
    );
  END IF;

  -- Rate limit only authenticated callers, which are the only callers that
  -- write scan history.
  IF v_user_id IS NOT NULL THEN
    v_rate_check := check_scan_rate_limit(v_user_id);
    IF NOT (v_rate_check->>'allowed')::boolean THEN
      RETURN jsonb_build_object(
        'api_version',         '1.0',
        'error',               'rate_limit_exceeded',
        'message',             'Too many scans. Please try again later.',
        'retry_after_seconds', (v_rate_check->>'retry_after_seconds')::integer,
        'current_count',       (v_rate_check->>'current_count')::integer,
        'max_allowed',         (v_rate_check->>'max_allowed')::integer
      );
    END IF;
  END IF;

  -- Resolve scan country from the explicit request first, then the user's
  -- stored preference. Anonymous callers without an explicit country remain
  -- unscoped.
  v_scan_country := p_scan_country;
  IF v_scan_country IS NULL AND v_user_id IS NOT NULL THEN
    SELECT up.country INTO v_scan_country
    FROM public.user_preferences up
    WHERE up.user_id = v_user_id;
  END IF;

  v_language := resolve_language(NULL);

  -- Only active products may satisfy a barcode lookup. When duplicate EANs
  -- exist across countries, prefer the requested country and use product_id as
  -- the deterministic fallback for both scoped and unscoped scans.
  SELECT p.product_id, p.product_name, p.product_name_en, p.name_translations,
         p.brand, p.category, p.country, p.unhealthiness_score, p.nutri_score_label
    INTO v_product
    FROM public.products p
   WHERE p.ean = TRIM(p_ean)
     AND p.is_deprecated IS NOT TRUE
   ORDER BY CASE
              WHEN v_scan_country IS NOT NULL AND p.country = v_scan_country THEN 0
              ELSE 1
            END,
            p.product_id
   LIMIT 1;

  IF FOUND THEN
    v_found := true;
    v_product_id := v_product.product_id;

    SELECT cref.default_language INTO v_country_lang
    FROM public.country_ref cref
    WHERE cref.country_code = v_product.country;
    v_country_lang := COALESCE(v_country_lang, LOWER(v_product.country));

    SELECT COALESCE(ct.display_name, cr.display_name),
           COALESCE(cr.icon_emoji, '📦')
    INTO v_cat_display, v_cat_icon
    FROM public.category_ref cr
    LEFT JOIN public.category_translations ct
      ON ct.category = cr.category AND ct.language_code = v_language
    WHERE cr.category = v_product.category;
  END IF;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.scan_history (user_id, ean, product_id, found, scan_country)
    VALUES (v_user_id, TRIM(p_ean), v_product_id, v_found, v_scan_country);
  END IF;

  IF v_found THEN
    RETURN jsonb_build_object(
      'api_version',           '1.0',
      'found',                 true,
      'product_id',            v_product.product_id,
      'product_name',          v_product.product_name,
      'product_name_en',       v_product.product_name_en,
      'product_name_display',  CASE
        WHEN v_language = v_country_lang THEN v_product.product_name
        WHEN v_language = 'en' THEN COALESCE(v_product.product_name_en, v_product.product_name)
        ELSE COALESCE(
          v_product.name_translations->>v_language,
          v_product.product_name_en,
          v_product.product_name
        )
      END,
      'brand',                 v_product.brand,
      'category',              v_product.category,
      'category_display',      v_cat_display,
      'category_icon',         v_cat_icon,
      'unhealthiness_score',   v_product.unhealthiness_score,
      'nutri_score',           v_product.nutri_score_label,
      'scan_country',          v_scan_country,
      'product_country',       v_product.country,
      'is_cross_country',      (v_scan_country IS NOT NULL
                                AND v_product.country IS DISTINCT FROM v_scan_country)
    );
  END IF;

  -- Preserve the country-scoped pending-submission behavior added by the
  -- migration that introduced the regression.
  RETURN jsonb_build_object(
    'api_version', '1.0',
    'found',       false,
    'ean',         TRIM(p_ean),
    'has_pending_submission', CASE
      WHEN v_scan_country IS NOT NULL THEN EXISTS (
        SELECT 1
        FROM public.product_submissions
        WHERE ean = TRIM(p_ean)
          AND suggested_country = v_scan_country
          AND status = 'pending'
      )
      ELSE EXISTS (
        SELECT 1
        FROM public.product_submissions
        WHERE ean = TRIM(p_ean)
          AND status = 'pending'
      )
    END,
    'scan_country', v_scan_country
  );
END;
$$;

COMMENT ON FUNCTION public.api_record_scan(text, text) IS
  'Record a barcode scan and look up an active product. Prefer the requested country for duplicate EANs, return cross-country disposition, and scope pending submissions by scan country. Enforces 100 scans per 24 hours per authenticated user.';

-- Preserve the existing callable boundary explicitly; do not widen access.
REVOKE ALL ON FUNCTION public.api_record_scan(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.api_record_scan(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.api_record_scan(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_record_scan(text, text) TO service_role;
