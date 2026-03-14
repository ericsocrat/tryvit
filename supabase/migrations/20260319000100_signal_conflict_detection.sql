-- Migration: Add signal-conflict detection to api_score_explanation()
-- Issue: #885 — fix(scoring): add signal-conflict detection to api_score_explanation()
-- Depends on: 20260315002200_score_explanation_v33_api.sql
-- Rollback: Re-deploy the previous api_score_explanation function body from 20260315002200
-- Idempotency: CREATE OR REPLACE — safe to run 1× or 100×

-- Changes (additive, backward compatible):
-- 1. Adds 'conflicts' array to 'summary' — detects when headline sentiment
--    contradicts co-displayed Nutri-Score, NOVA, high_* flags, or ingredient concerns.
-- 2. Adds 'qualified_headline' to 'summary' — equals headline when clean,
--    appends highest-severity conflict note when contradictions exist.
-- 3. Implements 6 messaging rules (M1–M6) per issue #885 spec.
-- 4. All existing response keys preserved unchanged.

CREATE OR REPLACE FUNCTION public.api_score_explanation(p_product_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      m.product_id,
      m.product_name,
      m.brand,
      m.category,
      m.country,
      m.score_breakdown,
      m.unhealthiness_score,
      m.nutri_score_label,
      m.nutri_score_source,
      m.nova_classification,
      m.processing_risk,
      m.high_salt_flag,
      m.high_sugar_flag,
      m.high_sat_fat_flag,
      m.high_additive_load,
      m.has_palm_oil,
      m.ingredient_concern_score,
      pp.score_model_version,
      pp.scored_at,
      COALESCE(cref.nutri_score_official, false) AS nutri_score_official,
      COALESCE(nf.protein_g, 0) AS protein_g,
      COALESCE(nf.fibre_g, 0)   AS fibre_g,
      -- Derived headline band token for conflict rule evaluation
      CASE
        WHEN m.unhealthiness_score <= 15 THEN 'very_well'
        WHEN m.unhealthiness_score <= 30 THEN 'moderate'
        WHEN m.unhealthiness_score <= 50 THEN 'concern'
        ELSE                                  'significant'
      END AS headline_band,
      CASE
        WHEN m.unhealthiness_score <= 20 THEN 'low'
        WHEN m.unhealthiness_score <= 40 THEN 'moderate'
        WHEN m.unhealthiness_score <= 60 THEN 'elevated'
        WHEN m.unhealthiness_score <= 80 THEN 'high'
        ELSE                                  'very_high'
      END AS score_band
    FROM public.v_master m
    JOIN public.products pp ON pp.product_id = m.product_id
    LEFT JOIN public.country_ref cref ON cref.country_code = m.country
    LEFT JOIN public.nutrition_facts nf ON nf.product_id = m.product_id
    WHERE m.product_id = p_product_id
  ),
  conflict_rules AS (
    -- M1: headline ∈ {very_well, moderate} AND nova = '4'
    SELECT jsonb_build_object(
      'rule',     'M1',
      'key',      'nova_ultra_processed',
      'severity', 'high',
      'message',  'Note: this product is classified as ultra-processed (NOVA 4).'
    ) AS conflict
    FROM base
    WHERE headline_band IN ('very_well', 'moderate')
      AND nova_classification = '4'
    UNION ALL
    -- M2: headline ∈ {very_well, moderate} AND nutri_score ∈ {D, E}
    SELECT jsonb_build_object(
      'rule',     'M2',
      'key',      'nutri_score_poor',
      'severity', 'high',
      'message',  'Note: Nutri-Score rates this product ' || nutri_score_label || '.'
    )
    FROM base
    WHERE headline_band IN ('very_well', 'moderate')
      AND nutri_score_label IN ('D', 'E')
    UNION ALL
    -- M3: headline = 'very_well' AND high_salt_flag = 'YES'
    SELECT jsonb_build_object(
      'rule',     'M3',
      'key',      'high_salt_flag',
      'severity', 'medium',
      'message',  'Note: high salt content flagged.'
    )
    FROM base
    WHERE headline_band = 'very_well'
      AND high_salt_flag = 'YES'
    UNION ALL
    -- M3: headline = 'very_well' AND high_sugar_flag = 'YES'
    SELECT jsonb_build_object(
      'rule',     'M3',
      'key',      'high_sugar_flag',
      'severity', 'medium',
      'message',  'Note: high sugar content flagged.'
    )
    FROM base
    WHERE headline_band = 'very_well'
      AND high_sugar_flag = 'YES'
    UNION ALL
    -- M3: headline = 'very_well' AND high_sat_fat_flag = 'YES'
    SELECT jsonb_build_object(
      'rule',     'M3',
      'key',      'high_sat_fat_flag',
      'severity', 'medium',
      'message',  'Note: high saturated fat content flagged.'
    )
    FROM base
    WHERE headline_band = 'very_well'
      AND high_sat_fat_flag = 'YES'
    UNION ALL
    -- M4: headline ∈ {concern, significant} AND nutri_score ∈ {A, B}
    SELECT jsonb_build_object(
      'rule',     'M4',
      'key',      'nutri_score_favorable',
      'severity', 'info',
      'message',  'Note: Nutri-Score rates this product favorably (' || nutri_score_label || ').'
    )
    FROM base
    WHERE headline_band IN ('concern', 'significant')
      AND nutri_score_label IN ('A', 'B')
    UNION ALL
    -- M5: headline ∈ {concern, significant} AND nova ∈ {'1', '2'}
    SELECT jsonb_build_object(
      'rule',     'M5',
      'key',      'nova_minimal_processing',
      'severity', 'info',
      'message',  'Note: NOVA classifies this as minimally processed.'
    )
    FROM base
    WHERE headline_band IN ('concern', 'significant')
      AND nova_classification IN ('1', '2')
    UNION ALL
    -- M6: band ≤ 'moderate' AND ingredient_concern_score > 50
    SELECT jsonb_build_object(
      'rule',     'M6',
      'key',      'high_ingredient_concern',
      'severity', 'medium',
      'message',  'Note: contains ingredients with elevated concern levels.'
    )
    FROM base
    WHERE score_band IN ('low', 'moderate')
      AND COALESCE(ingredient_concern_score, 0) > 50
  ),
  conflicts_agg AS (
    SELECT COALESCE(jsonb_agg(conflict ORDER BY
      CASE conflict->>'severity'
        WHEN 'high'   THEN 1
        WHEN 'medium' THEN 2
        WHEN 'info'   THEN 3
      END,
      conflict->>'rule'
    ), '[]'::jsonb) AS conflicts
    FROM conflict_rules
  )
  SELECT jsonb_build_object(
      'api_version',     '1.0',
      'product_id',      b.product_id,
      'product_name',    b.product_name,
      'brand',           b.brand,
      'category',        b.category,
      'score_breakdown', b.score_breakdown,
      'model_version',   b.score_model_version,
      'scored_at',       b.scored_at,
      'summary', jsonb_build_object(
          'score',       b.unhealthiness_score,
          'score_band',  b.score_band,
          'headline',    CASE
                           WHEN b.headline_band = 'very_well' THEN
                               'This product scores very well. It has low levels of nutrients of concern.'
                           WHEN b.headline_band = 'moderate' THEN
                               'This product has a moderate profile. Some areas could be better.'
                           WHEN b.headline_band = 'concern' THEN
                               'This product has several areas of nutritional concern.'
                           ELSE
                               'This product has significant nutritional concerns across multiple factors.'
                         END,
          'qualified_headline',
                         CASE
                           WHEN ca.conflicts = '[]'::jsonb THEN
                             -- No conflicts: qualified = headline
                             CASE
                               WHEN b.headline_band = 'very_well' THEN
                                   'This product scores very well. It has low levels of nutrients of concern.'
                               WHEN b.headline_band = 'moderate' THEN
                                   'This product has a moderate profile. Some areas could be better.'
                               WHEN b.headline_band = 'concern' THEN
                                   'This product has several areas of nutritional concern.'
                               ELSE
                                   'This product has significant nutritional concerns across multiple factors.'
                             END
                           ELSE
                             -- Conflicts exist: append highest-severity conflict note
                             CASE
                               WHEN b.headline_band = 'very_well' THEN
                                   'This product scores very well. It has low levels of nutrients of concern.'
                               WHEN b.headline_band = 'moderate' THEN
                                   'This product has a moderate profile. Some areas could be better.'
                               WHEN b.headline_band = 'concern' THEN
                                   'This product has several areas of nutritional concern.'
                               ELSE
                                   'This product has significant nutritional concerns across multiple factors.'
                             END
                             || ' ' || (ca.conflicts->0->>'message')
                         END,
          'conflicts',   ca.conflicts,
          'nutri_score',       b.nutri_score_label,
          'nutri_score_source', b.nutri_score_source,
          'nutri_score_official_in_country', b.nutri_score_official,
          'nutri_score_note',  CASE
                                 WHEN b.nutri_score_official = false
                                      AND b.nutri_score_label IS NOT NULL
                                      AND b.nutri_score_label NOT IN ('NOT-APPLICABLE', 'UNKNOWN')
                                 THEN 'Nutri-Score is not officially adopted in this country. This grade is computed from nutrition data and may differ from grades shown on the physical label.'
                                 ELSE NULL
                               END,
          'nova_group',        b.nova_classification,
          'processing_risk',   b.processing_risk
      ),
      'top_factors', (
          SELECT jsonb_agg(f ORDER BY (f->>'weighted')::numeric DESC)
          FROM jsonb_array_elements(b.score_breakdown->'factors') AS f
          WHERE (f->>'weighted')::numeric > 0
      ),
      'nutrient_bonus', (
          SELECT jsonb_build_object(
              'factor', nd->>'name',
              'raw',    (nd->>'raw')::numeric,
              'weighted', (nd->>'weighted')::numeric,
              'components', nd->'components'
          )
          FROM jsonb_array_elements(b.score_breakdown->'factors') AS nd
          WHERE nd->>'name' = 'nutrient_density'
            AND (nd->>'weighted')::numeric < 0
          LIMIT 1
      ),
      'warnings', (
          SELECT jsonb_agg(w) FROM (
              SELECT jsonb_build_object('type', 'high_salt',    'message', 'Salt content exceeds 1.5g per 100g.')    AS w WHERE b.high_salt_flag = 'YES'
              UNION ALL
              SELECT jsonb_build_object('type', 'high_sugar',   'message', 'Sugar content is elevated.')             WHERE b.high_sugar_flag = 'YES'
              UNION ALL
              SELECT jsonb_build_object('type', 'high_sat_fat', 'message', 'Saturated fat content is elevated.')     WHERE b.high_sat_fat_flag = 'YES'
              UNION ALL
              SELECT jsonb_build_object('type', 'additives',    'message', 'This product has a high additive load.') WHERE b.high_additive_load = 'YES'
              UNION ALL
              SELECT jsonb_build_object('type', 'palm_oil',     'message', 'Contains palm oil.')                     WHERE COALESCE(b.has_palm_oil, false) = true
              UNION ALL
              SELECT jsonb_build_object('type', 'nova_4',       'message', 'Classified as ultra-processed (NOVA 4).') WHERE b.nova_classification = '4'
              UNION ALL
              SELECT jsonb_build_object('type', 'good_protein', 'message', 'Good source of protein.')
                WHERE b.protein_g >= 10
              UNION ALL
              SELECT jsonb_build_object('type', 'good_fibre',   'message', 'Good source of fibre.')
                WHERE b.fibre_g >= 3
          ) warnings
      ),
      'category_context', (
          SELECT jsonb_build_object(
              'category_avg_score', ROUND(AVG(p2.unhealthiness_score), 1),
              'category_rank',      (
                  SELECT COUNT(*) + 1
                  FROM public.v_master m2
                  WHERE m2.category = b.category
                    AND m2.country = b.country
                    AND m2.unhealthiness_score < b.unhealthiness_score
              ),
              'category_total',     COUNT(*)::int,
              'relative_position',  CASE
                  WHEN b.unhealthiness_score <= AVG(p2.unhealthiness_score) * 0.7 THEN 'much_better_than_average'
                  WHEN b.unhealthiness_score <= AVG(p2.unhealthiness_score)       THEN 'better_than_average'
                  WHEN b.unhealthiness_score <= AVG(p2.unhealthiness_score) * 1.3 THEN 'worse_than_average'
                  ELSE 'much_worse_than_average'
              END
          )
          FROM public.products p2
          WHERE p2.category = b.category
            AND p2.country = b.country
            AND p2.is_deprecated IS NOT TRUE
      )
  )
  FROM base b
  CROSS JOIN conflicts_agg ca;
$function$;

COMMENT ON FUNCTION public.api_score_explanation IS
  'Purpose: Score breakdown + human-readable headline + warnings + signal-conflict detection + category context
   Auth: none (public/anon)
   Params: p_product_id (required bigint)
   Returns: JSONB {api_version, product_id, product_name, brand, category,
     score_breakdown, model_version, scored_at,
     summary: {score, score_band, headline, qualified_headline, conflicts, nutri_score, ...},
     top_factors, nutrient_bonus, warnings, category_context}
   Conflicts: Array of {rule, key, severity, message} per M1-M6 messaging rules.
     Empty array when no contradictions detected.
   Qualified headline: headline + highest-severity conflict note (or plain headline if clean).
   Backward compatible: headline field unchanged. Issues #611, #885.';
