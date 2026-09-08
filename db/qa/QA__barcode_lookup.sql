-- Current evidence-first QA. Synthetic fixtures and claims are transaction-local.
-- Run only through the approved local QA workflow; ROLLBACK preserves all data.
BEGIN;
CREATE TEMP TABLE qa_context AS SELECT gen_random_uuid() AS uid;
INSERT INTO auth.users(id) SELECT uid FROM qa_context;
INSERT INTO public.user_preferences(user_id,country,diet_preference,strict_diet,strict_allergen,avoid_allergens,treat_may_contain_as_unsafe,preferred_language)
SELECT uid,'PL','none',false,false,ARRAY[]::text[],false,'en' FROM qa_context
ON CONFLICT(user_id) DO UPDATE SET country='PL',diet_preference='none',strict_diet=false,strict_allergen=false,avoid_allergens=ARRAY[]::text[],treat_may_contain_as_unsafe=false,preferred_language='en';
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true) FROM qa_context;
CREATE FUNCTION pg_temp.qa_ok(condition boolean) RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN condition IS TRUE THEN 0 ELSE 1 END; $$;
CREATE FUNCTION pg_temp.qa_retired(payload jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT payload = jsonb_build_object('api_version','2','policy_version','evidence-first-v1',
    'error','refresh_required','status','refresh_required','message','Refresh TryVit to use source-backed product evidence.');
$$;

INSERT INTO public.products(country,brand,product_name,category,ean)
SELECT market,uid::text,'Qabarcode '||market,'Dairy','9910000000706' FROM qa_context CROSS JOIN (VALUES('PL'),('DE')) countries(market);
CREATE TEMP TABLE qa_scan AS SELECT public.api_record_scan_v2('9910000000706','PL') b;
SELECT '1. known barcode resolves the exact controlled PL product' AS check_name, pg_temp.qa_ok((SELECT b->>'found'='true' AND b->'product'->>'product_name'='Qabarcode PL' FROM qa_scan)) AS violations;
SELECT '2. unknown barcode returns explicit not-found' AS check_name, pg_temp.qa_ok(public.api_record_scan_v2('9910000000720','PL')->>'found'='false') AS violations;
SELECT '3. duplicate barcode DE request resolves DE' AS check_name, pg_temp.qa_ok(public.api_record_scan_v2('9910000000706','DE')->'product'->>'country'='DE') AS violations;
SELECT '4. unsupported country is an error not a false lookup miss' AS check_name, pg_temp.qa_ok(public.api_record_scan_v2('9910000000706','XX')->>'error'='Unsupported scan country') AS violations;
SELECT '5. scan metadata and score retirement remain explicit' AS check_name, pg_temp.qa_ok((SELECT b->>'scan_country'='PL' AND b->'product'->'score'->>'status'='retired' AND b->'product'->'score'->'value'='null'::jsonb AND NOT(b ?| ARRAY['unhealthiness_score','nutri_score']) FROM qa_scan)) AS violations;
SELECT '6. v2 scan has a version and legacy detail requires refresh' AS check_name, pg_temp.qa_ok((SELECT b->>'api_version'='2' AND b->>'policy_version'='evidence-first-v1' FROM qa_scan) AND pg_temp.qa_retired(public.api_product_detail_by_ean('9910000000706','PL'))) AS violations;
SELECT '7. EAN checksum function is immutable' AS check_name, pg_temp.qa_ok(EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname='is_valid_ean' AND p.provolatile='i')) AS violations;
SELECT '8. all active product EANs pass checksum validation' AS check_name,COUNT(*) AS violations FROM public.products WHERE ean IS NOT NULL AND is_deprecated IS NOT TRUE AND NOT public.is_valid_ean(ean);
SELECT '9. submission barcode checksum trigger remains installed' AS check_name, pg_temp.qa_ok(EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name='trg_submission_ean_check' AND event_object_table='product_submissions')) AS violations;
ROLLBACK;
