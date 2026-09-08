-- Synthetic transaction only; run against the isolated migration-chain database.
BEGIN;
SELECT no_plan();

SELECT ok(NOT has_function_privilege('anon','public.api_product_read_model(bigint[],text)','EXECUTE'),'anonymous cannot read protected evidence API');
SELECT ok(NOT has_function_privilege('authenticated','evidence_private.product_one(bigint,text)','EXECUTE'),'internal projection is not a client entrypoint');
SELECT ok(NOT has_function_privilege('authenticated','public.compute_provenance_confidence(bigint)','EXECUTE'),'privileged diagnostic is not directly client-callable');
SELECT ok(has_function_privilege('service_role','public.compute_provenance_confidence(bigint)','EXECUTE'),'operational role retains diagnostic access');
SELECT is(public.api_product_read_model(ARRAY[1]::bigint[])->>'error','Authentication required','empty session fails closed even with SQL-owner execution');

INSERT INTO public.products(country,brand,product_name,category,ean)
VALUES('PL','Read model fixture','Recorded product','Dairy','9910000000881');
CREATE TEMP TABLE read_fixture AS SELECT product_id FROM public.products WHERE brand='Read model fixture';
UPDATE public.products SET product_name_en='Translation of a previous package' WHERE product_id IN (SELECT product_id FROM read_fixture);
INSERT INTO public.nutrition_facts(product_id,calories,total_fat_g,saturated_fat_g,trans_fat_g,carbs_g,sugars_g,fibre_g,protein_g,salt_g)
SELECT product_id,80,1.1234,0.1,NULL,6,4.1,0,6,0 FROM read_fixture;

SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
CREATE TEMP TABLE read_response AS SELECT public.api_product_read_model(ARRAY[product_id,product_id,9007199254740991]::bigint[],'en') AS body FROM read_fixture;
SELECT is((SELECT body->>'api_version' FROM read_response),'2','read contract is versioned');
SELECT is((SELECT body->'products'->0->>'product_name' FROM read_response),'Recorded product','unbound legacy translation does not override current identity');
SELECT is((SELECT jsonb_array_length(body->'products') FROM read_response),1,'duplicate selections are deduplicated');
SELECT is((SELECT jsonb_array_length(body->'missing_ids') FROM read_response),1,'missing product is not fabricated');
SELECT is((SELECT body->'products'->0->'score'->>'status' FROM read_response),'retired','legacy score is retired');
SELECT is((SELECT body->'products'->0->'score'->'value' FROM read_response),'null'::jsonb,'no universal score is published');
SELECT is((SELECT body->'products'->0->'nutrition'->'total_fat_g'->>'value' FROM read_response),'1.1234','stored source precision is retained');
SELECT is((SELECT body->'products'->0->'nutrition'->'salt_g'->>'value' FROM read_response),'0','explicit zero remains zero');
SELECT is((SELECT body->'products'->0->'nutrition'->'trans_fat_g'->'value' FROM read_response),'null'::jsonb,'unknown does not become zero');
SELECT is((SELECT body->'products'->0->'nutrition'->'total_fat_g'->>'state' FROM read_response),'unverified','legacy numeric presence is not verification');
SELECT is((SELECT body->'products'->0->'nutrition'->'total_fat_g'->>'basis' FROM read_response),'unknown','legacy basis is not guessed');
SELECT is((SELECT body->'products'->0->'suitability'->>'vegan' FROM read_response),'unknown','unknown ingredients do not establish vegan suitability');
SELECT is((SELECT body->'products'->0->'allergens'->>'state' FROM read_response),'missing','missing allergen records do not establish absence');
SELECT is((SELECT jsonb_array_length(body->'products'->0->'sources') FROM read_response),0,'no provenance is fabricated by the migration');
SELECT is(public.api_product_read_model(ARRAY[-1]::bigint[])->>'error','Invalid product selection','invalid selection rejected');
SELECT is(public.api_product_read_model(ARRAY[9007199254740992]::bigint[])->>'error','Invalid product selection','IDs that cannot round-trip through JavaScript are rejected');
SELECT is(public.api_product_read_model(ARRAY[]::bigint[],'xx')->>'error','Unsupported language','unknown locale rejected');
SELECT is(jsonb_array_length(public.api_product_read_model(ARRAY[]::bigint[])->'products'),0,'empty selection has explicit empty envelope');

-- Exercise actual role execution, not only ACL catalog metadata. The public
-- provenance wrapper remains owner-executed, while direct diagnostic calls fail.
GRANT SELECT ON read_fixture TO authenticated;
SET LOCAL ROLE authenticated;
SELECT throws_ok('SELECT public.compute_provenance_confidence(1)','42501',
  'permission denied for function compute_provenance_confidence','authenticated cannot directly execute the privileged diagnostic');
SELECT lives_ok('SELECT public.api_product_provenance((SELECT product_id FROM read_fixture))',
  'approved owner-executed provenance wrapper still works');
RESET ROLE;

-- Exercise the entire importer -> selected source -> read-model path, rather
-- than accepting a fixture-only frontend shape as proof of integration.
CREATE FUNCTION pg_temp.seal_read_observation(r jsonb) RETURNS jsonb LANGUAGE sql AS $$
  WITH body AS (SELECT r->'sanitized_payload' || jsonb_build_object(
    'extractor_version','off-observations-v1','extraction',r->'extracted_fields','projected_identity',r->'identity',
    'ingredient_assertions',r->'ingredients','allergen_assertions',r->'allergen_assertions',
    'set_states',jsonb_build_object('ingredients_state',r->>'ingredients_state','allergens_state',r->>'allergens_state'),
    'observation_metadata',jsonb_build_object('source_revision',r->'source_revision','source_url',r->'source_url',
      'license',r->'license','retrieved_at',r->'retrieved_at','source_updated_at',r->'source_updated_at',
      'validation_findings',r->'validation_findings')) AS payload)
  SELECT r || jsonb_build_object('sanitized_payload',payload,'payload_canonical',payload::text,
    'payload_hash',encode(sha256(convert_to(payload::text,'UTF8')),'hex')) FROM body
$$;
CREATE TEMP TABLE observed_record AS
WITH nutrient_keys AS (
  SELECT * FROM (VALUES ('calories_100g','energy-kcal_100g'),('fat_100g','fat_100g'),
    ('saturated_fat_100g','saturated-fat_100g'),('trans_fat_100g','trans-fat_100g'),
    ('carbs_100g','carbohydrates_100g'),('sugars_100g','sugars_100g'),('fiber_100g','fiber_100g'),
    ('protein_100g','proteins_100g'),('salt_100g','salt_100g')) AS keys(key,raw_key)
), payload AS (
  SELECT jsonb_build_object('code','9910000000997','rev',1,'brands','Observed fixture',
    'product_name','Observed beverage','nutrition_data_per','100ml','nutrition_data_unit','ml',
    'nutriscore_grade','a','nutriscore_version','2023',
    'image_front_url','https://images.openfoodfacts.org/images/products/local-test/front.jpg',
    'nutriments',jsonb_object_agg(raw_key,CASE WHEN key='calories_100g' THEN '80' ELSE '1.25' END),
    'ingredients',jsonb_build_array(jsonb_build_object('id','en:milk','text','Milk')),
    'allergens_tags',jsonb_build_array('en:milk'),'traces_tags','[]'::jsonb) AS body FROM nutrient_keys
),
fields AS (
  SELECT jsonb_object_agg(key,jsonb_build_object('value',CASE WHEN key='calories_100g' THEN '80' ELSE '1.25' END,
    'state','recorded','unit',CASE WHEN key='calories_100g' THEN 'kcal' ELSE 'g' END,
    'basis','per_100ml','preparation_state','as_sold','qualifier','eq',
    'source_field',raw_key,'transformation','off_normalized_value')) AS body
  FROM nutrient_keys
)
SELECT public.ingestion_apply_observation(
  '{"source_key":"off_api","country":"PL","extractor_version":"off-observations-v1","idempotency_key":"read-model-fixture-v1","scope":{"kind":"synthetic"}}'::jsonb,
  pg_temp.seal_read_observation(jsonb_build_object('external_id','9910000000997','identity',jsonb_build_object('ean','9910000000997','brand','Observed fixture','product_name','Observed beverage','category','Drinks'),
    'source_revision',1,'sanitized_payload',payload.body,'source_url','https://world.openfoodfacts.org/product/9910000000997',
    'license','ODbL-1.0','retrieved_at',now(),'source_updated_at',now()-interval '1 day',
    'extracted_fields',fields.body||jsonb_build_object('nutri_score_label',jsonb_build_object('value','A','state','recorded','version','2023','source_field','nutriscore_grade','transformation','uppercase_source_grade'),
      'brand',jsonb_build_object('value','Observed fixture','state','recorded','source_field','brands','transformation','off_primary_brand_v1'),
      'product_name',jsonb_build_object('value','Observed beverage','state','recorded','source_field','product_name','transformation','off_product_name_v1')),
    'ingredients_state','reported','ingredients',jsonb_build_array(jsonb_build_object('id','en:milk','text','Milk')),
    'allergens_state','reported','allergen_assertions',jsonb_build_array(jsonb_build_object('tag','milk','type','contains')),
    'validation_findings','[]'::jsonb))) AS result FROM payload,fields;
SELECT is((SELECT result->>'status' FROM observed_record),'accepted','source observation applies through the canonical importer');
CREATE TEMP TABLE observed_response AS SELECT public.api_product_read_model(ARRAY[(result->>'product_id')::bigint])->'products'->0 AS product FROM observed_record;
SELECT is((SELECT product->'nutrition'->'salt_g'->>'state' FROM observed_response),'recorded','selected source supplies recorded nutrition');
SELECT is((SELECT product->'nutrition'->'salt_g'->>'basis' FROM observed_response),'per_100ml','liquid basis survives the complete data flow');
SELECT is((SELECT product->'nutrition'->'salt_g'->>'observation_id' FROM observed_response),(SELECT result->>'observation_id' FROM observed_record),'field lineage resolves to exact immutable observation');
SELECT is((SELECT product->'sources'->0->>'observation_id' FROM observed_response),(SELECT result->>'observation_id' FROM observed_record),'source reference is available to the consumer');
SELECT is((SELECT product->'classifications'->'nutri_score'->>'version' FROM observed_response),'2023','source-reported classification retains algorithm version');
SELECT is((SELECT product->'allergens'->'contains'->0->>'name' FROM observed_response),'milk','known allergen stays visible');
SELECT is((SELECT product->'image'->>'url' FROM observed_response),
  'https://images.openfoodfacts.org/images/products/local-test/front.jpg','selected observation exposes source image without a second import');
SELECT is((SELECT product->'score'->'value' FROM observed_response),'null'::jsonb,'complete source data still does not justify an unsupported universal score');

SELECT public.record_field_provenance((SELECT (result->>'product_id')::bigint FROM observed_record),
  'fat_100g','manual',0.5,NULL,'Synthetic conflicting provenance test',NULL);
SELECT is(public.api_product_read_model(ARRAY[(SELECT (result->>'product_id')::bigint FROM observed_record)])->'products'->0->'nutrition'->'total_fat_g'->>'state',
  'conflicting','legacy provenance overwrite cannot retain falsely recorded source evidence');
SELECT is(public.api_product_read_model(ARRAY[(SELECT (result->>'product_id')::bigint FROM observed_record)])->'products'->0->'nutrition'->'total_fat_g'->'value',
  'null'::jsonb,'mismatched provenance withholds the prior source value');
SELECT is(public.api_product_read_model(ARRAY[(SELECT (result->>'product_id')::bigint FROM observed_record)])->'products'->0->'evidence'->>'state',
  'conflicting','projection mismatch blocks product-level comparison');
SELECT is(evidence_private.allergen_key('en:sesame-seeds'),'sesame','OFF sesame alias maps to the existing preference key');
SELECT is(evidence_private.allergen_key('en:nuts'),'tree-nuts','OFF nuts alias maps without merging peanuts');
SELECT is(evidence_private.allergen_key('en:sulphur-dioxide-and-sulphites'),'sulphites','OFF sulphite alias maps to the existing preference key');
SELECT is(evidence_private.allergen_key('en:none'),NULL::text,'source none sentinel is not positive allergen evidence or a safety finding');
-- Restore this synthetic projection before the independent missing-input test.
-- The importer correctly refuses to overwrite an independently claimed source.
SELECT public.record_field_provenance((SELECT (result->>'product_id')::bigint FROM observed_record),
  'fat_100g','off_api',0.5,NULL,'Restore synthetic source after mismatch assertion',NULL);

-- A source can report allergens while omitting nutrition. Retain that useful
-- observation without claiming either numeric completeness or absent sources.
WITH previous AS (
  SELECT o.* FROM public.product_source_observations o
  WHERE id=(SELECT (result->>'observation_id')::uuid FROM observed_record)
), revised AS (
  SELECT pg_temp.seal_read_observation(jsonb_build_object(
    'external_id','9910000000997','identity',sanitized_payload->'projected_identity',
    'source_revision',2,'sanitized_payload',sanitized_payload || '{"rev":2,"nutriments":{}}'::jsonb,
    'source_url',source_url,'license',license,'retrieved_at',now(),'source_updated_at',NULL,
    'validation_findings','[]'::jsonb,'ingredients_state','reported','allergens_state','reported',
    'ingredients',sanitized_payload->'ingredients','allergen_assertions',sanitized_payload->'allergen_assertions',
    'extracted_fields',(SELECT jsonb_object_agg(key,CASE WHEN key LIKE '%_100g'
      THEN value || '{"value":null,"state":"missing","qualifier":null}'::jsonb ELSE value END)
      FROM jsonb_each(extracted_fields)))) AS body FROM previous
)
SELECT is(public.ingestion_apply_observation(
  '{"source_key":"off_api","country":"PL","extractor_version":"off-observations-v1","idempotency_key":"read-model-fixture-v1","scope":{"kind":"synthetic"}}',
  body)->>'status','accepted','source with missing nutrition is still an accepted observation') FROM revised;
SELECT is(public.api_product_read_model(ARRAY[(SELECT (result->>'product_id')::bigint FROM observed_record)])->'products'->0->'evidence'->>'state',
  'recorded','zero recorded nutrients does not erase source availability');
SELECT is(public.api_product_read_model(ARRAY[(SELECT (result->>'product_id')::bigint FROM observed_record)])->'products'->0->'evidence'->>'recorded_fields',
  '0','missing nutrients cannot inflate completeness');
SELECT * FROM finish();
ROLLBACK;
