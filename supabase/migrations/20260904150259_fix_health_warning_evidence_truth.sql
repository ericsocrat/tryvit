-- Health-warning truthfulness: canonical celiac matching and explicit evidence
-- completeness. The public RPC keeps its existing warning_count/warnings fields
-- and adds evidence_completeness + evaluation_disposition for fail-closed clients.
--
-- product_allergen_info stores positive evidence only. A missing gluten row is
-- therefore not proof that gluten is absent; celiac all-clear is withheld unless
-- positive gluten evidence already establishes a warning.

BEGIN;

CREATE OR REPLACE FUNCTION public.compute_health_warnings(
    p_product_id bigint,
    p_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_user_id      uuid := auth.uid();
    v_profile      record;
    v_product      record;
    v_nutrition    record;
    v_warnings     jsonb := '[]'::jsonb;
    v_high_sugar   boolean;
    v_high_salt    boolean;
    v_high_sat_fat boolean;
BEGIN
    IF p_profile_id IS NOT NULL THEN
        SELECT * INTO v_profile
        FROM public.user_health_profiles
        WHERE profile_id = p_profile_id AND user_id = v_user_id;
    ELSE
        SELECT * INTO v_profile
        FROM public.user_health_profiles
        WHERE user_id = v_user_id AND is_active = true
        LIMIT 1;
    END IF;

    IF v_profile IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT p.product_id, p.high_salt_flag, p.high_sugar_flag,
           p.high_sat_fat_flag, p.nova_classification
    INTO v_product
    FROM public.products p
    WHERE p.product_id = p_product_id
      AND p.is_deprecated IS NOT TRUE;

    IF v_product IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    v_high_sugar   := (UPPER(COALESCE(v_product.high_sugar_flag, '')) = 'YES');
    v_high_salt    := (UPPER(COALESCE(v_product.high_salt_flag, '')) = 'YES');
    v_high_sat_fat := (UPPER(COALESCE(v_product.high_sat_fat_flag, '')) = 'YES');

    SELECT nf.calories, nf.sugars_g, nf.salt_g, nf.saturated_fat_g, nf.protein_g
    INTO v_nutrition
    FROM public.nutrition_facts nf
    WHERE nf.product_id = p_product_id
    LIMIT 1;

    IF 'diabetes' = ANY(v_profile.health_conditions) THEN
        IF v_high_sugar THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'diabetes',
                'severity', 'high',
                'message', 'High sugar content — monitor blood glucose'
            );
        END IF;
        IF v_nutrition.sugars_g IS NOT NULL AND v_nutrition.sugars_g > 10 THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'diabetes',
                'severity', 'moderate',
                'message', format(
                    'Contains %sg sugar per 100g',
                    ROUND(v_nutrition.sugars_g, 1)
                )
            );
        END IF;
    END IF;

    IF 'hypertension' = ANY(v_profile.health_conditions) THEN
        IF v_high_salt THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'hypertension',
                'severity', 'high',
                'message', 'High salt content — limit sodium intake'
            );
        END IF;
        IF v_nutrition.salt_g IS NOT NULL AND v_nutrition.salt_g > 1.0 THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'hypertension',
                'severity', 'moderate',
                'message', format(
                    'Contains %sg salt per 100g',
                    ROUND(v_nutrition.salt_g, 2)
                )
            );
        END IF;
    END IF;

    IF 'heart_disease' = ANY(v_profile.health_conditions) THEN
        IF v_high_sat_fat THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'heart_disease',
                'severity', 'high',
                'message', 'High saturated fat — may impact cardiovascular health'
            );
        END IF;
        IF v_high_salt THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'heart_disease',
                'severity', 'moderate',
                'message', 'High salt — may raise blood pressure'
            );
        END IF;
    END IF;

    -- Allergen tags were normalized to canonical bare tags in Phase 5.
    IF 'celiac_disease' = ANY(v_profile.health_conditions) THEN
        IF EXISTS (
            SELECT 1
            FROM public.product_allergen_info pai
            WHERE pai.product_id = p_product_id
              AND pai.tag = 'gluten'
              AND pai.type = 'contains'
        ) THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'celiac_disease',
                'severity', 'critical',
                'message', 'Contains gluten — unsafe for celiac disease'
            );
        ELSIF EXISTS (
            SELECT 1
            FROM public.product_allergen_info pai
            WHERE pai.product_id = p_product_id
              AND pai.tag = 'gluten'
              AND pai.type = 'traces'
        ) THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'celiac_disease',
                'severity', 'critical',
                'message', 'May contain gluten traces — unsafe without confirmation for celiac disease'
            );
        END IF;
    END IF;

    IF 'gout' = ANY(v_profile.health_conditions) THEN
        IF v_nutrition.protein_g IS NOT NULL AND v_nutrition.protein_g > 20 THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'gout',
                'severity', 'moderate',
                'message', format(
                    'High protein (%sg/100g) — may increase uric acid',
                    ROUND(v_nutrition.protein_g, 1)
                )
            );
        END IF;
    END IF;

    IF 'kidney_disease' = ANY(v_profile.health_conditions) THEN
        IF v_nutrition.protein_g IS NOT NULL AND v_nutrition.protein_g > 15 THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'kidney_disease',
                'severity', 'moderate',
                'message', format(
                    'Protein: %sg/100g — discuss with doctor',
                    ROUND(v_nutrition.protein_g, 1)
                )
            );
        END IF;
        IF v_high_salt THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'kidney_disease',
                'severity', 'high',
                'message', 'High salt — limit sodium for kidney health'
            );
        END IF;
    END IF;

    IF 'ibs' = ANY(v_profile.health_conditions) THEN
        IF v_product.nova_classification::int = 4 THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'ibs',
                'severity', 'moderate',
                'message', 'Ultra-processed (NOVA 4) — may trigger IBS symptoms'
            );
        END IF;
    END IF;

    IF v_profile.max_sugar_g IS NOT NULL
       AND v_nutrition.sugars_g IS NOT NULL
       AND v_nutrition.sugars_g >= v_profile.max_sugar_g THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'custom_threshold',
                'severity', 'high',
                'message', format(
                    'Sugar: %sg meets or exceeds your limit of %sg per 100g',
                    ROUND(v_nutrition.sugars_g, 1),
                    ROUND(v_profile.max_sugar_g, 1)
                )
            );
    END IF;
    IF v_profile.max_salt_g IS NOT NULL
       AND v_nutrition.salt_g IS NOT NULL
       AND v_nutrition.salt_g >= v_profile.max_salt_g THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'custom_threshold',
                'severity', 'high',
                'message', format(
                    'Salt: %sg meets or exceeds your limit of %sg per 100g',
                    ROUND(v_nutrition.salt_g, 2),
                    ROUND(v_profile.max_salt_g, 2)
                )
            );
    END IF;
    IF v_profile.max_saturated_fat_g IS NOT NULL
       AND v_nutrition.saturated_fat_g IS NOT NULL
       AND v_nutrition.saturated_fat_g >= v_profile.max_saturated_fat_g THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'custom_threshold',
                'severity', 'high',
                'message', format(
                    'Saturated fat: %sg meets or exceeds your limit of %sg per 100g',
                    ROUND(v_nutrition.saturated_fat_g, 1),
                    ROUND(v_profile.max_saturated_fat_g, 1)
                )
            );
    END IF;
    IF v_profile.max_calories_kcal IS NOT NULL
       AND v_nutrition.calories IS NOT NULL
       AND v_nutrition.calories >= v_profile.max_calories_kcal THEN
            v_warnings := v_warnings || jsonb_build_object(
                'condition', 'custom_threshold',
                'severity', 'moderate',
                'message', format(
                    'Calories: %s meets or exceeds your limit of %s per 100g',
                    ROUND(v_nutrition.calories),
                    ROUND(v_profile.max_calories_kcal)
                )
            );
    END IF;

    RETURN v_warnings;
END;
$function$;

CREATE OR REPLACE FUNCTION public.api_product_health_warnings(
    p_product_id bigint,
    p_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_user_id             uuid := auth.uid();
    v_profile             record;
    v_product             record;
    v_nutrition           record;
    v_warnings            jsonb := '[]'::jsonb;
    v_required_evidence   text[] := ARRAY[]::text[];
    v_evaluated_evidence  text[] := ARRAY[]::text[];
    v_missing_evidence    text[] := ARRAY[]::text[];
    v_evidence_status     text;
    v_disposition         text;
    v_has_gluten_contains boolean := false;
    v_has_gluten_traces   boolean := false;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'api_version', '1.0',
            'error', 'Authentication required'
        );
    END IF;

    IF p_profile_id IS NOT NULL THEN
        SELECT * INTO v_profile
        FROM public.user_health_profiles
        WHERE profile_id = p_profile_id AND user_id = v_user_id;
    ELSE
        SELECT * INTO v_profile
        FROM public.user_health_profiles
        WHERE user_id = v_user_id AND is_active = true
        LIMIT 1;
    END IF;

    IF v_profile IS NULL THEN
        v_required_evidence := ARRAY['health_profile'];
        v_missing_evidence := ARRAY['health_profile'];
        RETURN jsonb_build_object(
            'api_version', '1.0',
            'product_id', p_product_id,
            'warning_count', 0,
            'warnings', '[]'::jsonb,
            'evaluation_disposition', 'not_evaluated',
            'evidence_completeness', jsonb_build_object(
                'status', 'unavailable',
                'required_count', 1,
                'evaluated_count', 0,
                'required', to_jsonb(v_required_evidence),
                'evaluated', '[]'::jsonb,
                'missing', to_jsonb(v_missing_evidence)
            )
        );
    END IF;

    SELECT p.product_id, p.high_salt_flag, p.high_sugar_flag,
           p.high_sat_fat_flag, p.nova_classification
    INTO v_product
    FROM public.products p
    WHERE p.product_id = p_product_id
      AND p.is_deprecated IS NOT TRUE;

    IF v_product IS NULL THEN
        v_required_evidence := ARRAY['product'];
        v_missing_evidence := ARRAY['product'];
        RETURN jsonb_build_object(
            'api_version', '1.0',
            'product_id', p_product_id,
            'warning_count', 0,
            'warnings', '[]'::jsonb,
            'evaluation_disposition', 'not_evaluated',
            'evidence_completeness', jsonb_build_object(
                'status', 'unavailable',
                'required_count', 1,
                'evaluated_count', 0,
                'required', to_jsonb(v_required_evidence),
                'evaluated', '[]'::jsonb,
                'missing', to_jsonb(v_missing_evidence)
            )
        );
    END IF;

    SELECT nf.product_id, nf.calories, nf.sugars_g, nf.salt_g,
           nf.saturated_fat_g, nf.protein_g
    INTO v_nutrition
    FROM public.nutrition_facts nf
    WHERE nf.product_id = p_product_id
    LIMIT 1;

    v_has_gluten_contains := EXISTS (
        SELECT 1
        FROM public.product_allergen_info pai
        WHERE pai.product_id = p_product_id
          AND pai.tag = 'gluten'
          AND pai.type = 'contains'
    );
    v_has_gluten_traces := EXISTS (
        SELECT 1
        FROM public.product_allergen_info pai
        WHERE pai.product_id = p_product_id
          AND pai.tag = 'gluten'
          AND pai.type = 'traces'
    );

    IF 'diabetes' = ANY(v_profile.health_conditions) THEN
        v_required_evidence := array_append(v_required_evidence, 'diabetes.high_sugar_flag');
        IF UPPER(COALESCE(v_product.high_sugar_flag, '')) IN ('YES', 'NO') THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'diabetes.high_sugar_flag');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'diabetes.high_sugar_flag');
        END IF;

        v_required_evidence := array_append(v_required_evidence, 'diabetes.sugars_g');
        IF v_nutrition.product_id IS NOT NULL AND v_nutrition.sugars_g IS NOT NULL THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'diabetes.sugars_g');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'diabetes.sugars_g');
        END IF;
    END IF;

    IF 'hypertension' = ANY(v_profile.health_conditions) THEN
        v_required_evidence := array_append(v_required_evidence, 'hypertension.high_salt_flag');
        IF UPPER(COALESCE(v_product.high_salt_flag, '')) IN ('YES', 'NO') THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'hypertension.high_salt_flag');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'hypertension.high_salt_flag');
        END IF;

        v_required_evidence := array_append(v_required_evidence, 'hypertension.salt_g');
        IF v_nutrition.product_id IS NOT NULL AND v_nutrition.salt_g IS NOT NULL THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'hypertension.salt_g');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'hypertension.salt_g');
        END IF;
    END IF;

    IF 'heart_disease' = ANY(v_profile.health_conditions) THEN
        v_required_evidence := array_append(v_required_evidence, 'heart_disease.saturated_fat_g');
        IF v_nutrition.product_id IS NOT NULL AND v_nutrition.saturated_fat_g IS NOT NULL THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'heart_disease.saturated_fat_g');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'heart_disease.saturated_fat_g');
        END IF;

        v_required_evidence := array_append(v_required_evidence, 'heart_disease.salt_g');
        IF v_nutrition.product_id IS NOT NULL AND v_nutrition.salt_g IS NOT NULL THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'heart_disease.salt_g');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'heart_disease.salt_g');
        END IF;

        v_required_evidence := array_append(v_required_evidence, 'heart_disease.high_saturated_fat_flag');
        IF UPPER(COALESCE(v_product.high_sat_fat_flag, '')) IN ('YES', 'NO') THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'heart_disease.high_saturated_fat_flag');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'heart_disease.high_saturated_fat_flag');
        END IF;

        v_required_evidence := array_append(v_required_evidence, 'heart_disease.high_salt_flag');
        IF UPPER(COALESCE(v_product.high_salt_flag, '')) IN ('YES', 'NO') THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'heart_disease.high_salt_flag');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'heart_disease.high_salt_flag');
        END IF;
    END IF;

    IF 'celiac_disease' = ANY(v_profile.health_conditions) THEN
        v_required_evidence := array_append(v_required_evidence, 'celiac_disease.gluten_assessment');
        IF v_has_gluten_contains OR v_has_gluten_traces THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'celiac_disease.gluten_assessment');
        ELSE
            -- Positive-only allergen storage cannot prove gluten absence.
            v_missing_evidence := array_append(v_missing_evidence, 'celiac_disease.gluten_assessment');
        END IF;
    END IF;

    IF 'gout' = ANY(v_profile.health_conditions) THEN
        v_required_evidence := array_append(v_required_evidence, 'gout.protein_g');
        IF v_nutrition.product_id IS NOT NULL AND v_nutrition.protein_g IS NOT NULL THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'gout.protein_g');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'gout.protein_g');
        END IF;
    END IF;

    IF 'kidney_disease' = ANY(v_profile.health_conditions) THEN
        v_required_evidence := array_append(v_required_evidence, 'kidney_disease.protein_g');
        IF v_nutrition.product_id IS NOT NULL AND v_nutrition.protein_g IS NOT NULL THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'kidney_disease.protein_g');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'kidney_disease.protein_g');
        END IF;

        v_required_evidence := array_append(v_required_evidence, 'kidney_disease.salt_g');
        IF v_nutrition.product_id IS NOT NULL AND v_nutrition.salt_g IS NOT NULL THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'kidney_disease.salt_g');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'kidney_disease.salt_g');
        END IF;

        v_required_evidence := array_append(v_required_evidence, 'kidney_disease.high_salt_flag');
        IF UPPER(COALESCE(v_product.high_salt_flag, '')) IN ('YES', 'NO') THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'kidney_disease.high_salt_flag');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'kidney_disease.high_salt_flag');
        END IF;
    END IF;

    IF 'ibs' = ANY(v_profile.health_conditions) THEN
        v_required_evidence := array_append(v_required_evidence, 'ibs.nova_classification');
        IF v_product.nova_classification IS NOT NULL THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'ibs.nova_classification');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'ibs.nova_classification');
        END IF;
    END IF;

    IF v_profile.max_sugar_g IS NOT NULL THEN
        v_required_evidence := array_append(v_required_evidence, 'custom_threshold.sugars_g');
        IF v_nutrition.product_id IS NOT NULL AND v_nutrition.sugars_g IS NOT NULL THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'custom_threshold.sugars_g');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'custom_threshold.sugars_g');
        END IF;
    END IF;

    IF v_profile.max_salt_g IS NOT NULL THEN
        v_required_evidence := array_append(v_required_evidence, 'custom_threshold.salt_g');
        IF v_nutrition.product_id IS NOT NULL AND v_nutrition.salt_g IS NOT NULL THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'custom_threshold.salt_g');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'custom_threshold.salt_g');
        END IF;
    END IF;

    IF v_profile.max_saturated_fat_g IS NOT NULL THEN
        v_required_evidence := array_append(v_required_evidence, 'custom_threshold.saturated_fat_g');
        IF v_nutrition.product_id IS NOT NULL AND v_nutrition.saturated_fat_g IS NOT NULL THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'custom_threshold.saturated_fat_g');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'custom_threshold.saturated_fat_g');
        END IF;
    END IF;

    IF v_profile.max_calories_kcal IS NOT NULL THEN
        v_required_evidence := array_append(v_required_evidence, 'custom_threshold.calories');
        IF v_nutrition.product_id IS NOT NULL AND v_nutrition.calories IS NOT NULL THEN
            v_evaluated_evidence := array_append(v_evaluated_evidence, 'custom_threshold.calories');
        ELSE
            v_missing_evidence := array_append(v_missing_evidence, 'custom_threshold.calories');
        END IF;
    END IF;

    v_warnings := public.compute_health_warnings(p_product_id, p_profile_id);

    IF cardinality(v_required_evidence) = 0 THEN
        v_evidence_status := 'not_applicable';
        v_disposition := 'not_applicable';
    ELSIF cardinality(v_missing_evidence) = 0 THEN
        v_evidence_status := 'complete';
        v_disposition := 'evaluated';
    ELSIF jsonb_array_length(v_warnings) > 0 THEN
        v_evidence_status := 'incomplete';
        v_disposition := 'partial';
    ELSE
        v_evidence_status := 'incomplete';
        v_disposition := 'withheld';
    END IF;

    RETURN jsonb_build_object(
        'api_version', '1.0',
        'product_id', p_product_id,
        'warning_count', jsonb_array_length(v_warnings),
        'warnings', v_warnings,
        'evaluation_disposition', v_disposition,
        'evidence_completeness', jsonb_build_object(
            'status', v_evidence_status,
            'required_count', cardinality(v_required_evidence),
            'evaluated_count', cardinality(v_evaluated_evidence),
            'required', to_jsonb(v_required_evidence),
            'evaluated', to_jsonb(v_evaluated_evidence),
            'missing', to_jsonb(v_missing_evidence)
        )
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.compute_health_warnings(bigint, uuid)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_health_warnings(bigint, uuid)
    TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.api_product_health_warnings(bigint, uuid)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_product_health_warnings(bigint, uuid)
    TO authenticated, service_role;

COMMENT ON FUNCTION public.compute_health_warnings(bigint, uuid) IS
'Computes known personalized warnings. Canonical allergen tags are bare tags such as gluten; absence of a positive allergen row is not interpreted as assessed absence.';

COMMENT ON FUNCTION public.api_product_health_warnings(bigint, uuid) IS
'Authenticated health-warning API. Legacy warning_count/warnings fields are retained. evidence_completeness and evaluation_disposition prevent missing condition-relevant evidence from being interpreted as an all-clear.';

COMMIT;
