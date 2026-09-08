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
SELECT 'PL',uid::text,'Qadiet '||label,'Dairy' FROM qa_context CROSS JOIN (VALUES('Unknown'),('Milk'),('Meat')) p(label);
CREATE TEMP TABLE qa_ingredients AS WITH inserted AS (
 INSERT INTO public.ingredient_ref(name_en,vegan,vegetarian)
 SELECT uid::text||' Milk','no','yes' FROM qa_context UNION ALL SELECT uid::text||' Meat','no','no' FROM qa_context
 RETURNING ingredient_id,name_en) SELECT * FROM inserted;
INSERT INTO public.product_ingredient(product_id,ingredient_id,position)
SELECT p.product_id,i.ingredient_id,1 FROM public.products p JOIN qa_context c ON p.brand=c.uid::text
JOIN qa_ingredients i ON right(p.product_name,4)=right(i.name_en,4);
UPDATE public.user_preferences SET diet_preference='vegan' WHERE user_id=(SELECT uid FROM qa_context);
CREATE TEMP TABLE qa_vegan AS SELECT public.api_find_products((SELECT uid::text FROM qa_context)) b;
SELECT '1. non-strict vegan excludes known non-vegan but does not certify unknowns' AS check_name, pg_temp.qa_ok((SELECT b->>'api_version'='2' AND b->>'total'='1' AND b->'results'->0->>'product_name'='Qadiet Unknown' AND b->'results'->0->'suitability'->>'vegan'='unknown' FROM qa_vegan)) AS violations;
UPDATE public.user_preferences SET diet_preference='vegetarian' WHERE user_id=(SELECT uid FROM qa_context);
CREATE TEMP TABLE qa_vegetarian AS SELECT public.api_find_products((SELECT uid::text FROM qa_context)) b;
SELECT '2. vegetarian preference excludes known meat' AS check_name, pg_temp.qa_ok((SELECT b->>'api_version'='2' AND b->>'total'='2' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b->'results') p WHERE p->>'product_name'='Qadiet Meat') FROM qa_vegetarian)) AS violations;
UPDATE public.user_preferences SET diet_preference='vegan',strict_diet=true WHERE user_id=(SELECT uid FROM qa_context);
SELECT '3. strict vegan withholds all unknown suitability' AS check_name, pg_temp.qa_ok(public.api_find_products((SELECT uid::text FROM qa_context))->>'total'='0') AS violations;
SELECT '4. retired diet category route requires refresh' AS check_name, pg_temp.qa_ok(pg_temp.qa_retired(public.api_category_listing('Dairy','score','asc',10,0,'PL','vegan'))) AS violations;
SELECT '5. retired alternatives cannot advertise dietary suitability' AS check_name, pg_temp.qa_ok(pg_temp.qa_retired(public.api_better_alternatives(-1))) AS violations;
UPDATE public.user_preferences SET diet_preference='none',strict_diet=false WHERE user_id=(SELECT uid FROM qa_context);
SELECT '6. no dietary preference returns all three fixtures' AS check_name, pg_temp.qa_ok(public.api_find_products((SELECT uid::text FROM qa_context))->>'total'='3') AS violations;
ROLLBACK;
