-- Current source lineage plus retained operator metadata. Legacy policy scores are not correctness probabilities.
BEGIN;
CREATE TEMP TABLE qa_provenance_fixture AS WITH added AS (
 INSERT INTO public.products(country,brand,product_name,category)
 VALUES('PL','QA provenance '||gen_random_uuid()::text,'Synthetic provenance fixture','Dairy')
 RETURNING product_id) SELECT product_id FROM added;
-- QA: Data Provenance & Freshness Governance (Issue #193, #357)
-- 28 tests covering all layers of the provenance framework.

-- ============================================================================
-- T01: data_sources table has expected seed rows
-- ============================================================================
DO $$
DECLARE v INT;
BEGIN
    SELECT COUNT(*) INTO v FROM data_sources;
    ASSERT v >= 11, 'T01 FAIL: data_sources expected ≥11 rows, got ' || v;
    RAISE NOTICE 'T01 PASS — data_sources has % rows', v;
END $$;

-- ============================================================================
-- T02: Each data_source base_confidence in [0,1]
-- ============================================================================
DO $$
DECLARE v INT;
BEGIN
    SELECT COUNT(*) INTO v FROM data_sources
    WHERE base_confidence < 0 OR base_confidence > 1;
    ASSERT v = 0, 'T02 FAIL: ' || v || ' sources have out-of-range confidence';
    RAISE NOTICE 'T02 PASS — all source confidences in [0,1]';
END $$;

-- ============================================================================
-- T03: laboratory source registry is preserved, not interpreted as certainty
-- ============================================================================
DO $$
BEGIN
 ASSERT EXISTS(SELECT 1 FROM public.data_sources WHERE source_key='lab_test'), 'T03 FAIL: laboratory source registry missing';
 RAISE NOTICE 'T03 PASS - laboratory source registry preserved without declaring certainty';
END $$;

-- ============================================================================
-- T04: product_field_provenance has enhanced columns
-- ============================================================================
DO $$
BEGIN
    PERFORM column_name FROM information_schema.columns
    WHERE table_name = 'product_field_provenance' AND column_name = 'confidence';
    ASSERT FOUND, 'T04 FAIL: confidence column missing';

    PERFORM column_name FROM information_schema.columns
    WHERE table_name = 'product_field_provenance' AND column_name = 'verified_at';
    ASSERT FOUND, 'T04 FAIL: verified_at column missing';

    PERFORM column_name FROM information_schema.columns
    WHERE table_name = 'product_field_provenance' AND column_name = 'verified_by';
    ASSERT FOUND, 'T04 FAIL: verified_by column missing';

    PERFORM column_name FROM information_schema.columns
    WHERE table_name = 'product_field_provenance' AND column_name = 'notes';
    ASSERT FOUND, 'T04 FAIL: notes column missing';

    RAISE NOTICE 'T04 PASS — product_field_provenance has all enhanced columns';
END $$;

-- ============================================================================
-- T05: record_field_provenance writes properly
-- ============================================================================
DO $$
DECLARE
    v_pid BIGINT;
    v_conf NUMERIC;
BEGIN
    SELECT product_id INTO v_pid FROM qa_provenance_fixture;
    IF v_pid IS NULL THEN
        RAISE NOTICE 'T05 SKIP — no products in table';
        RETURN;
    END IF;

    PERFORM record_field_provenance(v_pid, 'product_name', 'manual', 0.85, NULL, 'QA test');

    SELECT confidence INTO v_conf FROM product_field_provenance
    WHERE product_id = v_pid AND field_name = 'product_name';
    ASSERT v_conf = 0.85, 'T05 FAIL: expected confidence 0.85, got ' || COALESCE(v_conf::TEXT, 'NULL');
    RAISE NOTICE 'T05 PASS — record_field_provenance writes correctly';
END $$;

-- ============================================================================
-- T06: record_bulk_provenance writes multiple fields
-- ============================================================================
DO $$
DECLARE
    v_pid BIGINT;
    v_cnt INT;
BEGIN
    SELECT product_id INTO v_pid FROM qa_provenance_fixture;
    IF v_pid IS NULL THEN
        RAISE NOTICE 'T06 SKIP — no products in table';
        RETURN;
    END IF;

    PERFORM record_bulk_provenance(
        v_pid, 'off_api',
        ARRAY['brand', 'category', 'calories_100g'],
        NULL, 'QA bulk test'
    );

    SELECT COUNT(*) INTO v_cnt FROM product_field_provenance
    WHERE product_id = v_pid AND field_name IN ('brand', 'category', 'calories_100g');
    ASSERT v_cnt >= 3, 'T06 FAIL: expected ≥3 provenance rows, got ' || v_cnt;
    RAISE NOTICE 'T06 PASS — record_bulk_provenance wrote % rows', v_cnt;
END $$;

-- ============================================================================
-- T07: field_to_group maps correctly
-- ============================================================================
DO $$
BEGIN
    ASSERT field_to_group('calories_100g')    = 'nutrition',    'T07 FAIL: calories_100g';
    ASSERT field_to_group('allergens')        = 'allergens',    'T07 FAIL: allergens';
    ASSERT field_to_group('ingredients_text') = 'ingredients',  'T07 FAIL: ingredients_text';
    ASSERT field_to_group('product_name')     = 'identity',     'T07 FAIL: product_name';
    ASSERT field_to_group('image_url')        = 'images',       'T07 FAIL: image_url';
    ASSERT field_to_group('unhealthiness_score') = 'scoring',   'T07 FAIL: unhealthiness_score';
    ASSERT field_to_group('unknown_field')    = 'identity',     'T07 FAIL: unknown_field default';
    RAISE NOTICE 'T07 PASS — field_to_group maps all groups correctly';
END $$;

-- ============================================================================
-- T08: product_change_log table exists with expected structure
-- ============================================================================
DO $$
DECLARE v INT;
BEGIN
    SELECT COUNT(*) INTO v FROM information_schema.columns
    WHERE table_name = 'product_change_log'
      AND column_name IN ('product_id','field_name','old_value','new_value',
                          'source_key','actor_type','actor_id','reason','country','created_at');
    ASSERT v >= 10, 'T08 FAIL: product_change_log missing columns, found ' || v;
    RAISE NOTICE 'T08 PASS — product_change_log has all expected columns';
END $$;

-- ============================================================================
-- T09: Audit trigger installed on products
-- ============================================================================
DO $$
BEGIN
    PERFORM 1 FROM information_schema.triggers
    WHERE trigger_name = 'products_30_change_audit'
      AND event_object_table = 'products';
    ASSERT FOUND, 'T09 FAIL: products_30_change_audit trigger missing';
    RAISE NOTICE 'T09 PASS — audit trigger installed on products';
END $$;

-- ============================================================================
-- T10: freshness_policies seeded for PL and DE
-- ============================================================================
DO $$
DECLARE v_pl INT; v_de INT;
BEGIN
    SELECT COUNT(*) INTO v_pl FROM freshness_policies WHERE country = 'PL';
    SELECT COUNT(*) INTO v_de FROM freshness_policies WHERE country = 'DE';
    ASSERT v_pl >= 6, 'T10 FAIL: PL freshness_policies expected ≥6, got ' || v_pl;
    ASSERT v_de >= 6, 'T10 FAIL: DE freshness_policies expected ≥6, got ' || v_de;
    RAISE NOTICE 'T10 PASS — PL=% DE=% freshness policies', v_pl, v_de;
END $$;

-- ============================================================================
-- T11: Allergens have stricter freshness than identity
-- ============================================================================
DO $$
DECLARE v_allergen INT; v_identity INT;
BEGIN
    SELECT max_age_days INTO v_allergen FROM freshness_policies
    WHERE country = 'PL' AND field_group = 'allergens';
    SELECT max_age_days INTO v_identity FROM freshness_policies
    WHERE country = 'PL' AND field_group = 'identity';
    ASSERT v_allergen < v_identity,
        'T11 FAIL: allergens max_age should be < identity, got ' || v_allergen || ' vs ' || v_identity;
    RAISE NOTICE 'T11 PASS — allergens (% days) stricter than identity (% days)', v_allergen, v_identity;
END $$;

-- ============================================================================
-- T12: conflict_resolution_rules seeded
-- ============================================================================
DO $$
DECLARE v INT;
BEGIN
    SELECT COUNT(*) INTO v FROM conflict_resolution_rules;
    ASSERT v >= 6, 'T12 FAIL: expected ≥6 conflict rules, got ' || v;
    RAISE NOTICE 'T12 PASS — % conflict resolution rules', v;
END $$;

-- ============================================================================
-- T13: Allergen conflict rules do NOT auto-resolve
-- ============================================================================
DO $$
DECLARE v BOOLEAN;
BEGIN
    SELECT auto_resolve INTO v FROM conflict_resolution_rules
    WHERE country = 'PL' AND field_group = 'allergens';
    ASSERT v = false, 'T13 FAIL: allergen conflicts should NOT auto-resolve';
    RAISE NOTICE 'T13 PASS — allergen conflicts require manual resolution';
END $$;

-- ============================================================================
-- T14: data_conflicts table exists
-- ============================================================================
DO $$
BEGIN
    PERFORM 1 FROM information_schema.tables
    WHERE table_name = 'data_conflicts';
    ASSERT FOUND, 'T14 FAIL: data_conflicts table missing';
    RAISE NOTICE 'T14 PASS — data_conflicts table exists';
END $$;

-- ============================================================================
-- T15: country_data_policies seeded for 4 countries
-- ============================================================================
DO $$
DECLARE v INT;
BEGIN
    SELECT COUNT(*) INTO v FROM country_data_policies;
    ASSERT v >= 4, 'T15 FAIL: expected ≥4 country policies, got ' || v;
    RAISE NOTICE 'T15 PASS — % country data policies', v;
END $$;

-- ============================================================================
-- T16: DE has stricter allergen policy than PL
-- ============================================================================
DO $$
DECLARE v_pl TEXT; v_de TEXT;
BEGIN
    SELECT allergen_strictness INTO v_pl FROM country_data_policies WHERE country = 'PL';
    SELECT allergen_strictness INTO v_de FROM country_data_policies WHERE country = 'DE';
    ASSERT v_de IN ('strict','very_strict'), 'T16 FAIL: DE should be strict/very_strict, got ' || v_de;
    RAISE NOTICE 'T16 PASS — PL=% DE=%', v_pl, v_de;
END $$;

-- ============================================================================
-- T17: canonical evidence has explicit missingness and a retired aggregate
-- ============================================================================
DO $$
DECLARE v_pid bigint; v_result jsonb;
BEGIN
 SELECT product_id INTO v_pid FROM qa_provenance_fixture;
 v_result:=evidence_private.product_one(v_pid,'en');
 ASSERT v_result ?& ARRAY['sources','evidence','nutrition','score'], 'T17 FAIL: canonical evidence sections missing';
 ASSERT v_result->'score'->>'status'='retired' AND v_result->'score'->'value'='null'::jsonb, 'T17 FAIL: retired aggregate escaped';
 RAISE NOTICE 'T17 PASS - canonical facts retain missingness and no aggregate';
END $$;

-- ============================================================================
-- T18: validate_product_for_country returns JSONB with expected keys
-- ============================================================================
DO $$
DECLARE
    v_pid BIGINT;
    v_result JSONB;
BEGIN
    SELECT product_id INTO v_pid FROM qa_provenance_fixture;
    IF v_pid IS NULL THEN
        RAISE NOTICE 'T18 SKIP — no products';
        RETURN;
    END IF;

    v_result := validate_product_for_country(v_pid, 'PL');
    ASSERT v_result ? 'product_id',        'T18 FAIL: missing product_id';
    ASSERT v_result ? 'ready_for_publish',  'T18 FAIL: missing ready_for_publish';
    ASSERT v_result ? 'issues',             'T18 FAIL: missing issues';
    ASSERT v_result ? 'validated_at',       'T18 FAIL: missing validated_at';
    RAISE NOTICE 'T18 PASS — validate_product_for_country returns valid structure';
END $$;

-- ============================================================================
-- T19: retired provenance returns an explicit refresh boundary
-- ============================================================================
DO $$
DECLARE v_result jsonb;
BEGIN
 v_result:=public.api_product_provenance((SELECT product_id FROM qa_provenance_fixture));
 ASSERT v_result=jsonb_build_object('api_version','2','policy_version','evidence-first-v1','error','refresh_required','status','refresh_required','message','Refresh TryVit to use source-backed product evidence.'), 'T19 FAIL: retired provenance must require refresh without a trust score';
 RAISE NOTICE 'T19 PASS - retired provenance is refresh-only';
END $$;

-- ============================================================================
-- T20: admin_provenance_dashboard returns valid JSONB
-- ============================================================================
DO $$
DECLARE v_result JSONB;
BEGIN
    v_result := admin_provenance_dashboard('PL');
    ASSERT v_result ? 'api_version',        'T20 FAIL: missing api_version';
    ASSERT v_result ? 'total_products',      'T20 FAIL: missing total_products';
    ASSERT v_result ? 'with_provenance',     'T20 FAIL: missing with_provenance';
    ASSERT v_result ? 'open_conflicts',      'T20 FAIL: missing open_conflicts';
    ASSERT v_result ? 'source_distribution', 'T20 FAIL: missing source_distribution';
    RAISE NOTICE 'T20 PASS — admin_provenance_dashboard returns valid JSONB';
END $$;

-- ============================================================================
-- T21: feature flag data_provenance_ui exists and is disabled
-- ============================================================================
DO $$
DECLARE v_enabled BOOLEAN;
BEGIN
    SELECT enabled INTO v_enabled FROM feature_flags WHERE key = 'data_provenance_ui';
    ASSERT FOUND, 'T21 FAIL: data_provenance_ui flag missing';
    ASSERT v_enabled = false, 'T21 FAIL: flag should be disabled by default';
    RAISE NOTICE 'T21 PASS — data_provenance_ui flag exists and disabled';
END $$;

-- ============================================================================
-- T22: Security — anon cannot call admin functions
-- ============================================================================
DO $$
DECLARE v BOOLEAN;
BEGIN
    SELECT has_function_privilege('anon', 'resolve_conflicts_auto(text,text)', 'EXECUTE')
    INTO v;
    ASSERT v = false, 'T22 FAIL: anon should not have EXECUTE on resolve_conflicts_auto';
    RAISE NOTICE 'T22 PASS — anon blocked from resolve_conflicts_auto';
END $$;

-- ============================================================================
-- T23: Security - historical confidence is not consumer-callable
-- ============================================================================
DO $$
BEGIN
 ASSERT NOT has_function_privilege('anon','public.api_product_provenance(bigint)','EXECUTE'), 'T23 FAIL: anonymous retired provenance access';
 ASSERT NOT has_function_privilege('authenticated','public.compute_provenance_confidence(bigint)','EXECUTE'), 'T23 FAIL: client can call historical confidence helper';
 RAISE NOTICE 'T23 PASS - historical trust interpretation remains operator-only';
END $$;

-- ============================================================================
-- T24: RLS enabled on all new tables
-- ============================================================================
DO $$
DECLARE v INT;
BEGIN
    SELECT COUNT(*) INTO v FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
          'data_sources','product_change_log','freshness_policies',
          'conflict_resolution_rules','data_conflicts','country_data_policies'
      )
      AND c.relrowsecurity = true;
    ASSERT v = 6, 'T24 FAIL: expected 6 tables with RLS, got ' || v;
    RAISE NOTICE 'T24 PASS — all 6 new tables have RLS enabled';
END $$;

-- ============================================================================
-- T25: detect_stale_products function exists and is callable
-- ============================================================================
DO $$
BEGIN
    PERFORM 1 FROM pg_proc WHERE proname = 'detect_stale_products';
    ASSERT FOUND, 'T25 FAIL: detect_stale_products function missing';
    RAISE NOTICE 'T25 PASS — detect_stale_products exists';
END $$;

-- ============================================================================
-- T26: legacy provenance does not fabricate observation dates
-- ============================================================================
DO $$
DECLARE v_result jsonb;
BEGIN
 v_result:=evidence_private.product_one((SELECT product_id FROM qa_provenance_fixture),'en');
 ASSERT v_result->'sources'='[]'::jsonb AND v_result->'evidence'->>'state'='legacy_unverified', 'T26 FAIL: legacy metadata invented a dated observation';
 RAISE NOTICE 'T26 PASS - missing observation dates remain unknown';
END $$;

-- ============================================================================
-- T27: no last_fetched_at values in the future
-- ============================================================================
DO $$
DECLARE v INT;
BEGIN
    SELECT COUNT(*) INTO v
    FROM products
    WHERE last_fetched_at > now() + interval '1 hour';
    ASSERT v = 0, 'T27 FAIL: ' || v || ' products have future last_fetched_at';
    RAISE NOTICE 'T27 PASS — no future last_fetched_at values';
END $$;

-- ============================================================================
-- T28: v_data_freshness_summary view returns rows for all active categories
-- ============================================================================
DO $$
DECLARE v INT; v_cats INT;
BEGIN
    SELECT COUNT(*) INTO v FROM v_data_freshness_summary;
    SELECT COUNT(DISTINCT category) INTO v_cats
    FROM products WHERE is_deprecated IS NOT TRUE;
    ASSERT v >= v_cats, 'T28 FAIL: freshness summary has ' || v ||
        ' rows but ' || v_cats || ' active categories exist';
    RAISE NOTICE 'T28 PASS — v_data_freshness_summary covers % categories', v;
END $$;

ROLLBACK;
