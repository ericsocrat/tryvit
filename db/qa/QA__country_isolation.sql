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
SELECT market,uid::text,'Qacountry '||market,'Dairy','9910000000706' FROM qa_context CROSS JOIN (VALUES('PL'),('DE')) countries(market);
CREATE TEMP TABLE qa_products AS SELECT p.product_id,p.country,p.ean FROM public.products p JOIN qa_context c ON p.brand=c.uid::text;
CREATE TEMP TABLE qa_pl AS SELECT public.api_find_products((SELECT uid::text FROM qa_context),'{"country":"PL"}',1,20,false,'en') b;
CREATE TEMP TABLE qa_de AS SELECT public.api_find_products((SELECT uid::text FROM qa_context),'{"country":"DE"}',1,20,false,'de') b;
SELECT '1. PL search returns only the PL fixture' AS check_name, pg_temp.qa_ok((SELECT b->>'country'='PL' AND b->>'total'='1' AND b->'results'->0->>'country'='PL' FROM qa_pl)) AS violations;
SELECT '2. DE search returns only the DE fixture' AS check_name, pg_temp.qa_ok((SELECT b->>'country'='DE' AND b->>'total'='1' AND b->'results'->0->>'country'='DE' FROM qa_de)) AS violations;
SELECT '3. retired alternatives cannot return cross-market ranking' AS check_name, pg_temp.qa_ok(pg_temp.qa_retired(public.api_better_alternatives(-1))) AS violations;
SELECT '4. raw similarity helper cannot bypass country-aware readers' AS check_name, pg_temp.qa_ok(NOT has_function_privilege('authenticated','public.find_similar_products(bigint,integer,text,text[],boolean,boolean,boolean)','EXECUTE')) AS violations;
SELECT '5. duplicate EAN respects PL scan preference' AS check_name, pg_temp.qa_ok(public.api_record_scan_v2('9910000000706','PL')->'product'->>'country'='PL') AS violations;
SELECT '6. overview excludes inactive countries' AS check_name,COUNT(*) AS violations FROM public.v_api_category_overview_by_country ov JOIN public.country_ref cr ON cr.country_code=ov.country_code WHERE cr.is_active=false;
SELECT '7. effective country resolves the controlled PL preference' AS check_name, pg_temp.qa_ok(public.resolve_effective_country(NULL)='PL') AS violations;
SELECT '8. default search uses actual saved PL preference' AS check_name, pg_temp.qa_ok(public.api_find_products((SELECT uid::text FROM qa_context))->>'country'='PL') AS violations;
SELECT '9. filter options preserve explicit DE context' AS check_name, pg_temp.qa_ok(public.api_find_filter_options('DE','de')->>'country'='DE') AS violations;
SELECT '10. duplicate EAN respects DE scan preference' AS check_name, pg_temp.qa_ok(public.api_record_scan_v2('9910000000706','DE')->'product'->>'country'='DE') AS violations;
UPDATE public.user_preferences SET country='DE' WHERE user_id=(SELECT uid FROM qa_context);
SELECT '11. changed DE preference changes the actual search result' AS check_name, pg_temp.qa_ok(public.api_find_products((SELECT uid::text FROM qa_context))->'results'->0->>'country'='DE' AND public.resolve_effective_country(NULL)='DE') AS violations;
ROLLBACK;
