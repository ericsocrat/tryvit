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
SELECT 'PL',uid::text,'Qasemantics Alpha','Dairy' FROM qa_context;
CREATE TEMP TABLE qa_products AS SELECT p.product_id,p.country,p.product_name FROM public.products p JOIN qa_context c ON p.brand=c.uid::text;
-- 1. Every positive evidence row has a supported non-null basis.
SELECT '1. allergen evidence basis is valid' AS check_name,
       COUNT(*) AS violations
FROM product_allergen_info
WHERE evidence_basis IS NULL
   OR evidence_basis NOT IN (
       'explicit_source',
       'ingredient_derived',
       'legacy_unclassified'
   );

-- 2. Explicit source evidence must retain source traceability.
SELECT '2. explicit allergen evidence retains source tag' AS check_name,
       COUNT(*) AS violations
FROM product_allergen_info
WHERE evidence_basis = 'explicit_source'
  AND source_tag IS NULL;

-- 3. Deterministic ingredient rules may establish contains evidence only.
SELECT '3. ingredient-derived evidence is contains-only' AS check_name,
       COUNT(*) AS violations
FROM product_allergen_info
WHERE evidence_basis = 'ingredient_derived'
  AND type <> 'contains';


CREATE TEMP TABLE qa_model AS SELECT public.api_product_read_model(ARRAY[product_id],'en') b FROM qa_products;
SELECT '4. no positive evidence is explicitly missing not absent' AS check_name, pg_temp.qa_ok((SELECT b->'products'->0->'allergens'='{"state":"missing","contains":[],"traces":[]}'::jsonb FROM qa_model)) AS violations;
SELECT '5. canonical product allergens never assert assessed absence' AS check_name,COUNT(*) AS violations
FROM public.products p CROSS JOIN LATERAL evidence_private.product_one(p.product_id,'en') m
WHERE p.is_deprecated IS NOT TRUE AND (m->'allergens' ?| ARRAY['assessed_absent','allergen_free','absence_assessment']
 OR jsonb_typeof(m->'allergens'->'contains') IS DISTINCT FROM 'array' OR jsonb_typeof(m->'allergens'->'traces') IS DISTINCT FROM 'array');
SELECT '6. canonical batch retains requested unknown fixture and identity' AS check_name, pg_temp.qa_ok((SELECT jsonb_array_length(b->'products')=1 AND b->'products'->0->>'product_id'=(SELECT product_id::text FROM qa_products) AND b->'missing_ids'='[]'::jsonb FROM qa_model)) AS violations;
UPDATE public.user_preferences SET avoid_allergens=ARRAY['milk'],strict_allergen=true WHERE user_id=(SELECT uid FROM qa_context);
SELECT '7. strict allergen preference withholds unknowns not certifies absence' AS check_name, pg_temp.qa_ok(public.api_find_products((SELECT uid::text FROM qa_context))->>'total'='0') AS violations;
ROLLBACK;
