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
SELECT 'PL',uid::text,'Qaallergen '||label,'Dairy' FROM qa_context CROSS JOIN (VALUES('Contains'),('Traces'),('Unknown')) p(label);
INSERT INTO public.product_allergen_info(product_id,tag,type,evidence_basis)
SELECT p.product_id,t.tag,'contains','legacy_unclassified' FROM public.products p JOIN qa_context c ON p.brand=c.uid::text CROSS JOIN (VALUES('gluten'),('milk')) t(tag) WHERE p.product_name='Qaallergen Contains'
UNION ALL SELECT p.product_id,'gluten','traces','legacy_unclassified' FROM public.products p JOIN qa_context c ON p.brand=c.uid::text WHERE p.product_name='Qaallergen Traces';
CREATE TEMP TABLE qa_gluten AS SELECT public.api_find_products((SELECT uid::text FROM qa_context),'{"allergen_free":["gluten"]}') b;
CREATE TEMP TABLE qa_milk AS SELECT public.api_find_products((SELECT uid::text FROM qa_context),'{"allergen_free":["milk"]}') b;
SELECT '1. gluten exclusion removes contains evidence not unknowns' AS check_name, pg_temp.qa_ok((SELECT b->>'total'='2' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b->'results') p WHERE p->>'product_name'='Qaallergen Contains') FROM qa_gluten)) AS violations;
SELECT '2. milk exclusion removes its positive fixture' AS check_name, pg_temp.qa_ok((SELECT b->>'total'='2' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b->'results') p WHERE p->>'product_name'='Qaallergen Contains') FROM qa_milk)) AS violations;
UPDATE public.user_preferences SET avoid_allergens=ARRAY['gluten'],treat_may_contain_as_unsafe=true WHERE user_id=(SELECT uid FROM qa_context);
SELECT '3. saved trace setting removes contains and traces' AS check_name, pg_temp.qa_ok(public.api_find_products((SELECT uid::text FROM qa_context))->>'total'='1' AND public.api_find_products((SELECT uid::text FROM qa_context))->'results'->0->>'product_name'='Qaallergen Unknown') AS violations;
SELECT '4. retired category allergen route requires refresh' AS check_name, pg_temp.qa_ok(pg_temp.qa_retired(public.api_category_listing('Dairy','score','asc',10,0,'PL',NULL,ARRAY['milk']))) AS violations;
SELECT '5. retired alternatives cannot imply allergen safety' AS check_name, pg_temp.qa_ok(pg_temp.qa_retired(public.api_better_alternatives(-1))) AS violations;
UPDATE public.user_preferences SET avoid_allergens=ARRAY[]::text[],treat_may_contain_as_unsafe=false WHERE user_id=(SELECT uid FROM qa_context);
SELECT '6. unfiltered search retains all three evidence states' AS check_name, pg_temp.qa_ok(public.api_find_products((SELECT uid::text FROM qa_context))->>'total'='3') AS violations;
ROLLBACK;
