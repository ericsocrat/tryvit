-- Actual-role capability tests using transaction-only synthetic records.
BEGIN;
SELECT no_plan();
CREATE TEMP TABLE retired_calls(name text,expression text);
INSERT INTO retired_calls VALUES
('api_product_detail','api_product_detail(1)'),
('api_product_detail_by_ean','api_product_detail_by_ean(''9910000000990'',''PL'')'),
('api_get_product_profile','api_get_product_profile(1)'),
('api_get_product_profile_by_ean','api_get_product_profile_by_ean(''9910000000990'')'),
('api_search_products','api_search_products(''fixture'')'),
('api_search_autocomplete','api_search_autocomplete(''fixture'')'),
('api_search_did_you_mean','api_search_did_you_mean(''fixture'')'),
('api_get_filter_options','api_get_filter_options(''PL'')'),
('api_category_listing','api_category_listing(''Dairy'')'),
('api_category_overview','api_category_overview(''PL'')'),
('api_get_products_for_compare','api_get_products_for_compare(ARRAY[1]::bigint[])'),
('api_better_alternatives','api_better_alternatives(1)'),
('api_better_alternatives_v2','api_better_alternatives_v2(1)'),
('api_score_explanation','api_score_explanation(1)'),
('api_data_confidence','api_data_confidence(1)'),
('api_product_provenance','api_product_provenance(1)'),
('api_get_score_history','api_get_score_history(1)'),
('api_score_history','api_score_history(1)'),
('api_get_recently_viewed','api_get_recently_viewed()'),
('api_get_watchlist','api_get_watchlist()'),
('api_dashboard_insights','api_dashboard_insights()'),
('api_get_cross_country_links','api_get_cross_country_links(1)'),
('api_store_products','api_store_products(''fixture'',''PL'')'),
('api_product_health_warnings','api_product_health_warnings(1)');
CREATE TEMP TABLE retired_relations(name text);
INSERT INTO retired_relations VALUES
('v_master'),('mv_scoring_distribution'),('v_product_confidence'),('mv_ingredient_frequency'),
('product_score_history'),('product_field_provenance'),('product_links'),('recipe_ingredient_product'),
('score_distribution_snapshots'),('score_shadow_results'),('notification_queue');
GRANT SELECT ON retired_calls,retired_relations TO anon,authenticated,service_role;

INSERT INTO auth.users(id,email) VALUES('aaaa0000-1111-4111-8111-111111111111','api-retirement@test.tryvit.local');
INSERT INTO public.user_preferences(user_id,country,diet_preference,preferred_language)
VALUES('aaaa0000-1111-4111-8111-111111111111','PL','none','en')
ON CONFLICT(user_id) DO UPDATE SET country='PL',diet_preference='none',preferred_language='en';
SELECT set_config('request.jwt.claims','{"sub":"aaaa0000-1111-4111-8111-111111111111","role":"authenticated"}',true);
INSERT INTO public.products(country,brand,product_name,category,ean,unhealthiness_score)
VALUES('PL','Zxlegacy fixture','Zxlegacy audit product','Dairy','9910000000983',42);
CREATE TEMP TABLE retired_product AS SELECT product_id FROM public.products WHERE brand='Zxlegacy fixture';
GRANT SELECT ON retired_product TO anon,authenticated,service_role;
CREATE TEMP TABLE retired_math(expression text,expected jsonb);
INSERT INTO retired_math(expression) VALUES
 ('public.assign_confidence(95,''openfoodfacts'')'),
 ('public.compute_data_completeness((SELECT product_id FROM retired_product))'),
 ('public.compute_unhealthiness_v32(0,0,0,0,0,0,''none'',''none'',0)'),
 ('public.compute_unhealthiness_v33(0,0,0,0,0,0,''none'',''none'',0,0,0)'),
 ('public.explain_score_v32(0,0,0,0,0,0,''none'',''none'',0)'),
 ('public.explain_score_v33(0,0,0,0,0,0,''none'',''none'',0,0,0)'),
 ('public.compute_nutri_score_label(0,0,0,0,0,0,false)');
GRANT SELECT ON retired_math TO anon,authenticated,service_role;
INSERT INTO public.nutrition_facts(product_id,calories,total_fat_g) SELECT product_id,123,1 FROM retired_product;
INSERT INTO public.product_field_provenance(product_id,field_name,source_type,confidence,source_url)
SELECT product_id,'calories_100g','off_api',0.65,'https://example.org/audit-fixture' FROM retired_product;
DO $math$ DECLARE r record; v jsonb; BEGIN
 FOR r IN SELECT expression FROM retired_math LOOP
  EXECUTE 'SELECT to_jsonb('||r.expression||')' INTO v;
  UPDATE retired_math SET expected=v WHERE expression=r.expression;
 END LOOP;
END $math$;

SET LOCAL ROLE authenticated;
SELECT throws_ok('SELECT '||expression,'42501',NULL,'authenticated historical math denied: '||split_part(expression,'(',1)) FROM retired_math;
SELECT results_eq('SELECT public.'||expression||'->>''status''',$$SELECT 'refresh_required'::text$$,
  'authenticated public '||name||' requires refresh') FROM retired_calls;
SELECT results_eq('SELECT public.'||expression||'->>''error''',$$SELECT 'refresh_required'::text$$,
  'public '||name||' cannot be coerced into a successful empty payload') FROM retired_calls;
SELECT throws_ok('SELECT * FROM public.'||quote_ident(name)||' LIMIT 1','42501',NULL,
  'authenticated cannot read historical '||name||' directly') FROM retired_relations;
SELECT throws_ok($$SELECT evidence_private.api_product_detail(1)$$,'42501',NULL,'authenticated cannot invoke private historical detail');
SELECT throws_ok($$SELECT evidence_private.api_product_provenance(1)$$,'42501',NULL,'authenticated cannot invoke historical confidence');
SELECT throws_ok($$SELECT public.find_better_alternatives(1)$$,'42501',NULL,'raw alternative helper cannot bypass public retirement');
SELECT throws_ok($$SELECT public.find_better_alternatives_v2(1)$$,'42501',NULL,'v2 legacy alternative helper cannot bypass public retirement');
SELECT throws_ok($$SELECT public.find_similar_products(1)$$,'42501',NULL,'similar-product helper cannot leak legacy grades');
SELECT throws_ok($$SELECT public.compute_data_confidence(1)$$,'42501',NULL,'unvalidated confidence helper is operator-only');
SELECT throws_ok($$SELECT public.compute_health_warnings(1)$$,'42501',NULL,'unvalidated health interpretation helper is operator-only');

-- Current app reads and owner-scoped mutations still work under the real role.
SELECT is(public.api_product_read_model(ARRAY[(SELECT product_id FROM retired_product)])->'products'->0->'score'->'value','null'::jsonb,'canonical v2 product works for authenticated clients without a score');
SELECT is((public.api_find_products('zxlegacy')->>'total')::integer,1,'canonical Find still works after raw view grants are revoked');
SELECT is(public.api_home_read_model()->>'api_version','2','canonical Home still works under authenticated role');
SELECT lives_ok($$SELECT public.api_record_product_view((SELECT product_id FROM retired_product))$$,'ordinary view-history mutation is preserved');
SELECT is((public.api_home_read_model()->'stats'->>'total_viewed')::integer,1,'ordinary view-history result is visible');
SELECT lives_ok($$SELECT public.api_create_list('Retirement owner list')$$,'owner list creation still works');
SELECT is((public.api_home_read_model()->'stats'->>'custom_lists_count')::integer,1,'owner list count is preserved');
SELECT lives_ok($$SELECT user_id,country FROM public.user_preferences WHERE user_id=auth.uid()$$,'supported owner preference table access remains');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok('SELECT '||expression,'42501',NULL,'anonymous historical math denied: '||split_part(expression,'(',1)) FROM retired_math;
SELECT throws_ok('SELECT * FROM public.'||quote_ident(name)||' LIMIT 1','42501',NULL,
  'anonymous cannot read historical '||name||' directly') FROM retired_relations;
SELECT throws_ok($$SELECT public.api_product_detail(1)$$,'42501',NULL,'private beta public API is not opened to anonymous users');
SELECT throws_ok($$SELECT evidence_private.api_product_detail(1)$$,'42501',NULL,'anonymous cannot access private operator namespace');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT results_eq('SELECT to_jsonb('||expression||')',format('SELECT %L::jsonb',expected),
 'service historical result preserved: '||split_part(expression,'(',1)) FROM retired_math;
-- Real operator runtime, not lives_ok against a public error shim.
SELECT is((evidence_private.api_product_detail((SELECT product_id FROM retired_product))->'scores'->>'unhealthiness_score')::numeric,42::numeric,'private detail retains the actual historical stored score');
SELECT is(evidence_private.api_product_provenance((SELECT product_id FROM retired_product))->>'product_id',(SELECT product_id::text FROM retired_product),'private provenance executes for an actual product');
SELECT ok(evidence_private.api_product_provenance((SELECT product_id FROM retired_product))->'field_sources' ? 'calories_100g','private provenance actually reads retained field sources');
SELECT ok(NOT (evidence_private.api_product_provenance((SELECT product_id FROM retired_product)) ? 'error'),'private provenance is not the refresh-required shim');
SELECT is((evidence_private.api_product_detail_by_ean('9910000000983','PL')->'scores'->>'unhealthiness_score')::numeric,42::numeric,'private barcode audit resolves private historical detail');
SELECT lives_ok($$SELECT evidence_private.api_get_product_profile((SELECT product_id FROM retired_product),'en')$$,'private profile dependency graph remains callable');
SELECT ok(has_table_privilege('service_role','public.'||name,'SELECT'),'operator retains historical '||name) FROM retired_relations;
RESET ROLE;

SELECT is((SELECT count(*)::integer FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN retired_calls c ON c.name=p.proname WHERE n.nspname='evidence_private'),24,'all historical public implementations remain in the operator namespace');
SELECT ok(has_function_privilege('service_role','evidence_private.record_scan_transaction(text,text)','EXECUTE'),'protected historical scan transaction is untouched');
SELECT * FROM finish();
ROLLBACK;
