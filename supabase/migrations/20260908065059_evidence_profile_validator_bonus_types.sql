-- Validate historical penalty/bonus semantics without changing model config,
-- score functions, their registry hashes, or existing function privileges.
CREATE OR REPLACE FUNCTION public.validate_country_profile(
    p_version text,
    p_country text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_rec record;
    v_config jsonb;
    v_total_weight numeric := 0;
    v_bonus_weight numeric := 0;
    v_factor_count integer := 0;
    v_factor jsonb;
    v_type text;
    v_name text;
    v_names text[] := '{}';
    v_weight numeric;
    v_issues text[] := '{}';
BEGIN
    SELECT * INTO v_rec FROM public.scoring_model_versions WHERE version = p_version;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Version not found: ' || p_version);
    END IF;
    v_config := v_rec.config;
    IF v_rec.country_overrides ? p_country THEN
        v_config := v_config || (v_rec.country_overrides->p_country);
    END IF;

    IF jsonb_typeof(v_config->'factors') IS DISTINCT FROM 'array' THEN
        v_issues := array_append(v_issues, 'Factors must be an array');
    ELSE
        FOR v_factor IN SELECT jsonb_array_elements(v_config->'factors') LOOP
            v_factor_count := v_factor_count + 1;
            IF jsonb_typeof(v_factor) IS DISTINCT FROM 'object' THEN
                v_issues := array_append(v_issues, 'Factor #' || v_factor_count || ' must be an object');
                CONTINUE;
            END IF;
            v_name := v_factor->>'name';
            IF jsonb_typeof(v_factor->'name') IS DISTINCT FROM 'string' OR btrim(v_name) = '' THEN
                v_issues := array_append(v_issues, 'Factor #' || v_factor_count || ' requires a nonempty string name');
                CONTINUE;
            END IF;
            IF v_name = ANY(v_names) THEN
                v_issues := array_append(v_issues, 'Duplicate factor name: ' || v_name);
            END IF;
            v_names := array_append(v_names, v_name);
            v_type := v_factor->>'type';
            -- v3.2 predates explicit continuous types; JSON null is not omission.
            IF p_version = 'v3.2' AND NOT (v_factor ? 'type') THEN
                v_type := 'continuous';
            END IF;
            IF v_type IS NULL OR v_type NOT IN ('continuous', 'categorical', 'bonus') THEN
                v_issues := array_append(v_issues, 'Factor ' || v_name || ' has unknown or missing type');
                CONTINUE;
            END IF;
            -- JSON numbers are finite; strings including NaN/Infinity are invalid.
            IF jsonb_typeof(v_factor->'weight') IS DISTINCT FROM 'number' THEN
                v_issues := array_append(v_issues, 'Factor ' || v_name || ' requires a finite numeric weight');
                CONTINUE;
            END IF;
            v_weight := (v_factor->>'weight')::numeric;
            IF v_type = 'bonus' THEN
                v_bonus_weight := v_bonus_weight + v_weight;
                IF v_weight >= 0 THEN
                    v_issues := array_append(v_issues, 'Factor ' || v_name || ' requires a negative bonus weight');
                END IF;
            ELSE
                v_total_weight := v_total_weight + v_weight;
                IF v_weight <= 0 THEN
                    v_issues := array_append(v_issues, 'Factor ' || v_name || ' has non-positive penalty weight');
                END IF;
            END IF;
            IF v_type <> 'categorical' AND v_factor ? 'ceiling' THEN
                IF jsonb_typeof(v_factor->'ceiling') IS DISTINCT FROM 'number' THEN
                    v_issues := array_append(v_issues, 'Factor ' || v_name || ' requires a finite numeric ceiling');
                ELSIF (v_factor->>'ceiling')::numeric <= 0 THEN
                    v_issues := array_append(v_issues, 'Factor ' || v_name || ' has non-positive ceiling');
                END IF;
            END IF;
        END LOOP;
        IF v_factor_count = 0 THEN
            v_issues := array_append(v_issues, 'Factors must not be empty');
        END IF;
    END IF;
    IF ABS(v_total_weight - 1.0) >= 0.01 THEN
        v_issues := array_append(v_issues,
            'Penalty weight sum = ' || round(v_total_weight, 4) || ' (expected 1.0 ±0.01)');
    END IF;
    RETURN jsonb_build_object(
        'valid', cardinality(v_issues) = 0,
        -- Preserve total_weight as the signed sum; expose penalty sum separately.
        'total_weight', round(v_total_weight + v_bonus_weight, 4),
        'penalty_weight', round(v_total_weight, 4),
        'bonus_weight', round(v_bonus_weight, 4),
        'factor_count', v_factor_count,
        'version', p_version,
        'country', p_country,
        'issues', to_jsonb(v_issues)
    );
END;
$fn$;
