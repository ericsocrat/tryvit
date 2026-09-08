-- C lineage regressions. Synthetic transaction only; no retained data changes.
BEGIN;
SELECT no_plan();
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
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
    'nutriscore_grade','a','nutriscore_version','2023','nova_group',4,
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
    'extracted_fields',fields.body||jsonb_build_object('nova_classification',jsonb_build_object('value','4','state','recorded','source_field','nova_group','transformation','source_integer'),'nutri_score_label',jsonb_build_object('value','A','state','recorded','version','2023','source_field','nutriscore_grade','transformation','uppercase_source_grade'),
      'brand',jsonb_build_object('value','Observed fixture','state','recorded','source_field','brands','transformation','off_primary_brand_v1'),
      'product_name',jsonb_build_object('value','Observed beverage','state','recorded','source_field','product_name','transformation','off_product_name_v1')),
    'ingredients_state','reported','ingredients',jsonb_build_array(jsonb_build_object('id','en:milk','text','Milk')),
    'allergens_state','reported','allergen_assertions',jsonb_build_array(jsonb_build_object('tag','milk','type','contains')),
    'validation_findings','[]'::jsonb))) AS result FROM payload,fields;
SELECT is((SELECT result->>'status' FROM observed_record),'accepted','source observation applies through the canonical importer');
CREATE TEMP TABLE observed_response AS SELECT public.api_product_read_model(ARRAY[(result->>'product_id')::bigint])->'products'->0 AS product FROM observed_record;

SELECT is((SELECT product->'classifications'->'nutri_score'->>'observation_id' FROM observed_response),
  (SELECT result->>'observation_id' FROM observed_record),'Nutri-Score retains exact observation');
SELECT is((SELECT product->'classifications'->'nova'->>'observation_id' FROM observed_response),
  (SELECT result->>'observation_id' FROM observed_record),'NOVA retains exact observation');
SELECT is((SELECT product->'image'->>'observation_id' FROM observed_response),
  (SELECT result->>'observation_id' FROM observed_record),'front image retains exact observation');
SELECT is((SELECT product->'image'->>'state' FROM observed_response),'recorded','selected image is recorded, not package-verified');
SELECT is((SELECT product->'image'->>'source_key' FROM observed_response),'off_api','image source key resolves to source observation');
SELECT ok(EXISTS(SELECT 1 FROM observed_response,jsonb_array_elements(product->'sources') s
  WHERE s->>'observation_id'=product->'image'->>'observation_id'
  AND s->>'source_key'=product->'image'->>'source_key'
  AND s->>'source_updated_at' IS NOT NULL),'image timestamps resolve through its exact source');

INSERT INTO public.product_images(product_id,url,source,image_type,is_primary)
SELECT (result->>'product_id')::bigint,'https://images.openfoodfacts.org/older-front.jpg','off_api','front',true FROM observed_record;
SELECT is(evidence_private.product_one((SELECT (result->>'product_id')::bigint FROM observed_record),'en')->'image'->>'url',
  'https://images.openfoodfacts.org/images/products/local-test/front.jpg','selected front image supersedes legacy front image of the same purpose');

INSERT INTO public.products(country,brand,product_name,category,ean)
VALUES('PL','Lineage synthetic','Legacy image only','Dairy','9910000000669');
CREATE TEMP TABLE legacy_image_product AS SELECT product_id FROM public.products WHERE brand='Lineage synthetic';
INSERT INTO public.product_images(product_id,url,source,image_type,is_primary)
SELECT product_id,'https://images.openfoodfacts.org/legacy-front.jpg','off_api','front',false FROM legacy_image_product
UNION ALL SELECT product_id,'https://images.openfoodfacts.org/ingredients.jpg','off_api','ingredients',true FROM legacy_image_product;
CREATE TEMP TABLE legacy_image_model AS SELECT evidence_private.product_one(product_id,'en') m FROM legacy_image_product;
SELECT is((SELECT m->'image'->>'url' FROM legacy_image_model),'https://images.openfoodfacts.org/legacy-front.jpg','legacy fallback has matching front-image purpose');
SELECT is((SELECT m->'image'->>'state' FROM legacy_image_model),'unverified','legacy fallback explicitly unverified');
SELECT is((SELECT m->'image'->'observation_id' FROM legacy_image_model),'null'::jsonb,'legacy fallback invents no observation');
SELECT is((SELECT m->'image'->'source_key' FROM legacy_image_model),'null'::jsonb,'legacy fallback borrows no dated source record');
SELECT is((SELECT jsonb_array_length(m->'sources') FROM legacy_image_model),0,'legacy import date is not exposed as an observation');
DELETE FROM public.product_images WHERE product_id IN(SELECT product_id FROM legacy_image_product) AND image_type='front';
SELECT is(evidence_private.product_one((SELECT product_id FROM legacy_image_product),'en')->'image','null'::jsonb,
  'ingredient-label photo is not substituted for missing front photo');
SELECT * FROM finish();
ROLLBACK;
