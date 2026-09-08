-- Local, synthetic operator regression only. Never run against production.
BEGIN;
SELECT no_plan();

CREATE TEMP TABLE repaired_operator_signatures(signature text PRIMARY KEY);
INSERT INTO repaired_operator_signatures VALUES
  ('public.admin_scoring_versions()'),
  ('public.admin_score_drift_report(numeric)'),
  ('public.governance_drift_check()'),
  ('public.report_slow_queries(double precision)'),
  ('public.snapshot_query_performance()'),
  ('public.validate_product_for_country(bigint,text)');

SELECT ok((SELECT bool_and(NOT has_function_privilege('anon',signature,'EXECUTE'))
  FROM repaired_operator_signatures),'anonymous access remains denied for every repaired operator');
SELECT ok((SELECT bool_and(NOT has_function_privilege('authenticated',signature,'EXECUTE'))
  FROM repaired_operator_signatures),'authenticated browser access remains denied for every repaired operator');
SELECT ok((SELECT bool_and(has_function_privilege('service_role',signature,'EXECUTE'))
  FROM repaired_operator_signatures),'service role retains every repaired operator');

SELECT is(jsonb_typeof(public.admin_scoring_versions()),'array','version report serializes actual records to JSONB');
SELECT is(jsonb_typeof(public.admin_score_drift_report(10)), 'object','drift report serializes actual records to JSONB');
SELECT is(public.admin_score_drift_report(10)->>'threshold_pct','10','caller drift threshold is unchanged');
SELECT is((SELECT count(*) FROM public.governance_drift_check()),8::bigint,'all eight governance checks execute without ambiguous output variables');
SELECT ok((SELECT bool_and(g.status IN ('pass','drift')) FROM public.governance_drift_check() g),
  'governance results retain their existing status contract');

SELECT is((SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
  WHERE e.extname='pg_stat_statements'),'extensions','diagnostic dependency uses its actual installed namespace');
SELECT lives_ok('SELECT count(*) FROM public.report_slow_queries(1000000000000)',
  'slow-query report resolves the extension view and executes without exposing query text');
SELECT is(jsonb_typeof(public.snapshot_query_performance()),'object','performance snapshot executes with its existing result envelope');
SELECT ok(public.snapshot_query_performance() ? 'rows_inserted','performance snapshot preserves its row-count contract');

-- The validation threshold is a synthetic fixture, not a scoring-model change.
INSERT INTO public.country_data_policies(country,primary_sources,regulatory_framework,allergen_strictness,
  min_confidence_for_publish,requires_local_language,active)
VALUES('PL',ARRAY['manual'],'SYNTHETIC operator fixture','strict',0.70,true,true)
ON CONFLICT(country) DO UPDATE SET allergen_strictness='strict',min_confidence_for_publish=0.70,requires_local_language=true;
INSERT INTO public.products(country,brand,product_name,category,ean)
VALUES('PL','Operator SQL fixture','Unverified operator fixture','Dairy','9910000999951');
CREATE TEMP TABLE operator_product AS SELECT product_id FROM public.products WHERE ean='9910000999951' AND country='PL';
CREATE TEMP TABLE validation_before AS
  SELECT public.validate_product_for_country(product_id,'PL') AS body FROM operator_product;
SELECT is((SELECT (body->>'ready_for_publish')::boolean FROM validation_before),false,
  'missing confidence never becomes ready-for-publish');
SELECT ok(EXISTS(SELECT 1 FROM validation_before v,jsonb_array_elements(v.body->'issues') issue
  WHERE issue->>'check'='minimum_confidence' AND issue->>'detail'='Confidence 0.00 below minimum 0.70'),
  'numeric explanation uses supported formatting with two-decimal rounding');
SELECT ok(EXISTS(SELECT 1 FROM validation_before v,jsonb_array_elements(v.body->'issues') issue
  WHERE issue->>'check'='allergen_data' AND issue->>'status'='fail'),
  'missing relational allergen evidence fails the strict country requirement');
INSERT INTO public.product_allergen_info(product_id,tag,type,evidence_basis)
SELECT product_id,'milk','contains','legacy_unclassified' FROM operator_product;
CREATE TEMP TABLE validation_after AS
  SELECT public.validate_product_for_country(product_id,'PL') AS body FROM operator_product;
SELECT ok(NOT EXISTS(SELECT 1 FROM validation_after v,jsonb_array_elements(v.body->'issues') issue
  WHERE issue->>'check'='allergen_data'),'existing canonical allergen relation supplies the data-availability check');
SELECT is((SELECT (body->>'ready_for_publish')::boolean FROM validation_after),false,
  'allergen presence cannot override the unchanged confidence threshold');
SELECT is(public.validate_product_for_country((SELECT product_id FROM operator_product),'ZZ')->>'ready_for_publish','false',
  'missing country policy still fails closed');

SET LOCAL ROLE service_role;
SELECT lives_ok('SELECT public.admin_scoring_versions()','service role can execute the repaired report through its actual permission boundary');
RESET ROLE;
-- Exercises the old suggestion query before consumer retirement; after retirement
-- the same public contract must safely return its explicit refresh disposition.
SELECT lives_ok('SELECT public.api_search_did_you_mean(''synthetic operator fixture'')',
  'suggestion reader never references the nonexistent products.id column');
SELECT * FROM finish();
ROLLBACK;
