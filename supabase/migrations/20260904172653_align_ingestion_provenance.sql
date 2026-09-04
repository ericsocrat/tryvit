-- Migration: Align ingestion provenance with current product field names
-- Issue:     New-user product truth and ingestion audit
-- Rollback:  Restore field_to_group() and compute_provenance_confidence()
--            from 20260227000000_data_provenance.sql.
--
-- This is function-only governance. It neither refreshes nor backfills data.

BEGIN;

CREATE OR REPLACE FUNCTION public.field_to_group(p_field_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
    SELECT CASE
        WHEN p_field_name IN (
            -- Canonical API/provenance names.
            'calories_100g', 'fat_100g', 'saturated_fat_100g',
            'trans_fat_100g', 'carbs_100g', 'sugars_100g',
            'fiber_100g', 'protein_100g', 'salt_100g',
            -- Physical nutrition_facts names retained for compatibility.
            'calories', 'total_fat_g', 'saturated_fat_g', 'trans_fat_g',
            'carbs_g', 'sugars_g', 'fibre_g', 'protein_g', 'salt_g'
        ) THEN 'nutrition'
        WHEN p_field_name IN (
            'allergens', 'allergen_tags', 'allergens_tags', 'traces_tags'
        ) THEN 'allergens'
        WHEN p_field_name IN (
            'ingredients_text', 'ingredients_raw', 'additives',
            'additive_count', 'additives_count', 'ingredient_concern_level',
            'prep_method', 'controversies'
        ) THEN 'ingredients'
        WHEN p_field_name IN (
            'product_name', 'product_name_en', 'brand', 'ean', 'category',
            'product_type', 'store_availability', 'source_type', 'source_url',
            'source_ean', 'last_fetched_at', 'off_revision'
        ) THEN 'identity'
        WHEN p_field_name IN (
            'image_url', 'image_front_url', 'image_ingredients_url',
            'image_nutrition_url'
        ) THEN 'images'
        WHEN p_field_name IN (
            'unhealthiness_score', 'nutri_score_label', 'nutri_score_source',
            'nova_classification', 'confidence', 'data_completeness_pct',
            'score_model_version'
        ) THEN 'scoring'
        ELSE 'identity'
    END
$function$;

COMMENT ON FUNCTION public.field_to_group(text) IS
'Map canonical API/provenance and physical storage field names to freshness '
'policy groups. Unknown historical names retain the identity fallback.';

REVOKE EXECUTE ON FUNCTION public.field_to_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.field_to_group(text)
    TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.compute_provenance_confidence(
    p_product_id bigint
)
RETURNS TABLE(
    overall_confidence       numeric,
    confidence_breakdown     jsonb,
    staleness_risk           text,
    data_completeness        numeric,
    source_diversity         integer,
    weakest_field            text,
    weakest_field_confidence numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_country     text;
    v_rec         record;
    v_total_conf  numeric := 0;
    v_field_count integer := 0;
    v_min_conf    numeric := 1;
    v_min_field   text;
    v_max_age     integer := 0;
    v_sources     text[] := '{}';
    v_breakdown   jsonb := '{}';
BEGIN
    SELECT p.country
    INTO v_country
    FROM public.products p
    WHERE p.product_id = p_product_id;

    IF v_country IS NULL THEN
        overall_confidence := 0;
        confidence_breakdown := '{}'::jsonb;
        staleness_risk := 'expired';
        data_completeness := 0;
        source_diversity := 0;
        weakest_field := 'all';
        weakest_field_confidence := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    FOR v_rec IN
        SELECT
            pf.field_name,
            pf.source_type,
            COALESCE(pf.confidence, ds.base_confidence, 0.5) AS base_conf,
            EXTRACT(EPOCH FROM (now() - pf.recorded_at))::integer / 86400
                AS age_days
        FROM public.product_field_provenance pf
        LEFT JOIN public.data_sources ds
            ON ds.source_key = pf.source_type
        WHERE pf.product_id = p_product_id
    LOOP
        DECLARE
            v_penalty  numeric := 1.0;
            v_eff_conf numeric;
            v_policy   record;
        BEGIN
            SELECT *
            INTO v_policy
            FROM public.freshness_policies
            WHERE country = v_country
              AND field_group = public.field_to_group(v_rec.field_name)
            LIMIT 1;

            IF v_policy IS NOT NULL THEN
                v_penalty := CASE
                    WHEN v_rec.age_days <= v_policy.warning_age_days THEN 1.0
                    WHEN v_rec.age_days <= v_policy.critical_age_days THEN 0.8
                    WHEN v_rec.age_days <= v_policy.max_age_days THEN 0.5
                    ELSE 0.2
                END;
            END IF;

            v_eff_conf := v_rec.base_conf * v_penalty;
            -- Derived outputs remain visible in the breakdown, but they are
            -- not independent evidence and must not inflate trust,
            -- completeness, freshness, or source diversity.
            IF v_rec.source_type <> 'derived_calculation' THEN
                v_total_conf := v_total_conf + v_eff_conf;
                v_field_count := v_field_count + 1;

                IF v_eff_conf < v_min_conf THEN
                    v_min_conf := v_eff_conf;
                    v_min_field := v_rec.field_name;
                END IF;

                IF v_rec.age_days > v_max_age THEN
                    v_max_age := v_rec.age_days;
                END IF;

                IF v_rec.source_type IS NOT NULL
                   AND NOT (v_rec.source_type = ANY(v_sources))
                THEN
                    v_sources := array_append(v_sources, v_rec.source_type);
                END IF;
            END IF;

            v_breakdown := jsonb_set(
                v_breakdown,
                ARRAY[v_rec.field_name],
                jsonb_build_object(
                    'source', v_rec.source_type,
                    'base_confidence', v_rec.base_conf,
                    'freshness_penalty', v_penalty,
                    'effective_confidence', ROUND(v_eff_conf, 3),
                    'age_days', v_rec.age_days
                )
            );
        END;
    END LOOP;

    IF v_field_count = 0 THEN
        overall_confidence := 0;
        confidence_breakdown := v_breakdown;
        staleness_risk := 'expired';
        data_completeness := 0;
        source_diversity := 0;
        weakest_field := 'all';
        weakest_field_confidence := 0;
    ELSE
        overall_confidence := ROUND(v_total_conf / v_field_count, 3);
        confidence_breakdown := v_breakdown;
        staleness_risk := CASE
            WHEN v_max_age > 365 THEN 'expired'
            WHEN v_max_age > 180 THEN 'stale'
            WHEN v_max_age > 90 THEN 'aging'
            ELSE 'fresh'
        END;
        -- The historical 15-field denominator is retained. New canonical
        -- provenance fields must never make a percentage exceed 100.
        data_completeness := LEAST(
            100::numeric,
            ROUND(v_field_count::numeric / 15 * 100, 1)
        );
        source_diversity := COALESCE(array_length(v_sources, 1), 0);
        weakest_field := v_min_field;
        weakest_field_confidence := v_min_conf;
    END IF;

    RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.compute_provenance_confidence(bigint) IS
'Compute field-level provenance confidence and freshness. Provenance '
'completeness retains the historical 15-field denominator, excludes derived '
'outputs as independent evidence, and is capped at 100 percent.';

REVOKE EXECUTE ON FUNCTION public.compute_provenance_confidence(bigint)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_provenance_confidence(bigint)
    TO authenticated, service_role;

COMMIT;
