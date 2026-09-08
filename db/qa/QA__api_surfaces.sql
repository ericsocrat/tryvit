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
INSERT INTO public.products(country,brand,product_name,category)
SELECT 'PL',uid::text,'Qaapi Alpha','Dairy' FROM qa_context;
CREATE TEMP TABLE qa_products AS SELECT p.product_id,p.country,p.product_name FROM public.products p JOIN qa_context c ON p.brand=c.uid::text;

CREATE TEMP TABLE qa_model AS SELECT public.api_product_read_model(ARRAY[product_id],'en') body FROM qa_products;
CREATE TEMP TABLE qa_find AS SELECT public.api_find_products((SELECT uid::text FROM qa_context),'{"country":"PL"}',1,20,false,'en') body;
SELECT '1. retired detail requires refresh' AS check_name, pg_temp.qa_ok(pg_temp.qa_retired(public.api_product_detail(-1))) AS violations;
SELECT '2. retired search requires refresh' AS check_name, pg_temp.qa_ok(pg_temp.qa_retired(public.api_search_products('test'))) AS violations;
SELECT '3. retired score explanation has no score' AS check_name, pg_temp.qa_ok(pg_temp.qa_retired(public.api_score_explanation(-1))) AS violations;
SELECT '4. retired confidence has no percentage' AS check_name, pg_temp.qa_ok(pg_temp.qa_retired(public.api_data_confidence(-1))) AS violations;
SELECT '5. retired category listing has no ranked products' AS check_name, pg_temp.qa_ok(pg_temp.qa_retired(public.api_category_listing('Dairy','score','asc',5,0))) AS violations;
SELECT '6. retired alternatives has no winner' AS check_name, pg_temp.qa_ok(pg_temp.qa_retired(public.api_better_alternatives(-1))) AS violations;
SELECT '7. raw ranking helpers are not consumer APIs' AS check_name, pg_temp.qa_ok(NOT has_function_privilege('authenticated','public.find_similar_products(bigint,integer,text,text[],boolean,boolean,boolean)','EXECUTE') AND NOT has_function_privilege('authenticated','public.find_better_alternatives(bigint,boolean,integer,text,text[],boolean,boolean,boolean)','EXECUTE')) AS violations;
SELECT '8. canonical product API has explicit version and policy' AS check_name, pg_temp.qa_ok((SELECT body->>'api_version'='2' AND body->>'policy_version'='evidence-first-v1' FROM qa_model)) AS violations;
SELECT '9. requested fixture is present exactly once' AS check_name, pg_temp.qa_ok((SELECT jsonb_array_length(body->'products')=1 AND body->'products'->0->>'product_id'=(SELECT product_id::text FROM qa_products) AND body->'missing_ids'='[]'::jsonb FROM qa_model)) AS violations;
SELECT '10. canonical product contains all evidence sections' AS check_name, pg_temp.qa_ok((SELECT body->'products'->0 ?& ARRAY['nutrition','ingredients','allergens','sources','classifications','evidence','score'] FROM qa_model)) AS violations;
SELECT '11. nutrition has all nine explicit field states' AS check_name, pg_temp.qa_ok((SELECT (SELECT count(*) FROM jsonb_each(body->'products'->0->'nutrition'))=9 AND NOT EXISTS(SELECT 1 FROM jsonb_each(body->'products'->0->'nutrition') f WHERE f.value->>'state' IS DISTINCT FROM 'missing' OR f.value->'value' IS DISTINCT FROM 'null'::jsonb) FROM qa_model)) AS violations;
SELECT '12. unsupported product aggregate is explicitly retired' AS check_name, pg_temp.qa_ok((SELECT body->'products'->0->'score'->>'status'='retired' AND body->'products'->0->'score'->'value'='null'::jsonb FROM qa_model)) AS violations;
SELECT '13. unobserved fixture invents no source observations' AS check_name, pg_temp.qa_ok((SELECT body->'products'->0->'sources'='[]'::jsonb AND body->'products'->0->'evidence'->>'state'='legacy_unverified' FROM qa_model)) AS violations;
SELECT '14. unobserved fixture invents no source classifications' AS check_name, pg_temp.qa_ok((SELECT body->'products'->0->'classifications'->'nutri_score'->'value'='null'::jsonb AND body->'products'->0->'classifications'->'nova'->'value'='null'::jsonb FROM qa_model)) AS violations;
SELECT '15. canonical search returns the controlled fixture and pagination' AS check_name, pg_temp.qa_ok((SELECT body->>'api_version'='2' AND body->>'total'='1' AND jsonb_array_length(body->'results')=1 AND body ?& ARRAY['page','pages','page_size','filters_applied'] FROM qa_find)) AS violations;
SELECT '16. canonical search preserves requested country' AS check_name, pg_temp.qa_ok((SELECT body->>'country'='PL' AND body->'results'->0->>'country'='PL' FROM qa_find)) AS violations;
SELECT '17. retired list API cannot return nullable score rows' AS check_name, pg_temp.qa_ok(pg_temp.qa_retired(public.api_get_list_items((SELECT uid FROM qa_context)))) AS violations;
SELECT '18. no products for inactive countries' AS check_name,COUNT(*) AS violations FROM public.products p JOIN public.country_ref c ON c.country_code=p.country WHERE p.is_deprecated IS NOT TRUE AND c.is_active=false;
ROLLBACK;
