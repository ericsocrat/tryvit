-- Synthetic extractor-v2 boundary only. Never production data.
BEGIN;
SELECT no_plan();

CREATE FUNCTION pg_temp.v2_record(ean text, declared text, declared_unit text, basis text) RETURNS jsonb
LANGUAGE sql AS $$
  WITH missing AS (
    SELECT jsonb_object_agg(k,jsonb_build_object('value',NULL,'unit',CASE WHEN k='calories_100g' THEN 'kcal' ELSE 'g' END,
      'basis',basis,'preparation_state','as_sold','state','missing','qualifier',NULL,
      'source_field',CASE k WHEN 'calories_100g' THEN 'energy-kcal_100g' WHEN 'saturated_fat_100g' THEN 'saturated-fat_100g'
        WHEN 'trans_fat_100g' THEN 'trans-fat_100g' WHEN 'carbs_100g' THEN 'carbohydrates_100g'
        WHEN 'fiber_100g' THEN 'fiber_100g' WHEN 'protein_100g' THEN 'proteins_100g' ELSE k END,
      'transformation','off_normalized_value')) fields
    FROM unnest(ARRAY['calories_100g','saturated_fat_100g','trans_fat_100g','carbs_100g',
      'sugars_100g','fiber_100g','protein_100g','salt_100g']) k
  ), body AS (
    SELECT missing.fields || jsonb_build_object(
      'fat_100g',jsonb_build_object('value','1.5','unit','g','basis',basis,'preparation_state','as_sold','state','recorded',
        'qualifier','eq','source_field','fat_100g','transformation','off_normalized_value'),
      'ean',jsonb_build_object('value',ean,'state','recorded','source_field','code','transformation','source_string'),
      'brand',jsonb_build_object('value','V2 fixture','state','recorded','source_field','brands','transformation','off_primary_brand_v1'),
      'product_name',jsonb_build_object('value','V2 product','state','recorded','source_field','product_name','transformation','off_product_name_v1'),
      'category',jsonb_build_object('value','Drinks','state','recorded','source_field','categories_tags','transformation','off_category_v1')) fields
    FROM missing
  ), payload AS (
    SELECT jsonb_strip_nulls(jsonb_build_object('code',ean,'brands','V2 fixture','product_name','V2 product',
      'categories_tags',jsonb_build_array('en:beverages'),'nutriments',jsonb_build_object('fat_100g','1.5'),
      'nutrition_data_per',declared,'nutrition_data_per_unit',declared_unit,'ingredients',NULL,
      'allergens_tags','[]'::jsonb,'traces_tags','[]'::jsonb,'extractor_version','off-observations-v2',
      'extraction',body.fields,'projected_identity',jsonb_build_object('ean',ean,'brand','V2 fixture','product_name','V2 product','category','Drinks'),
      'ingredient_assertions',NULL,'allergen_assertions','[]'::jsonb,
      'set_states',jsonb_build_object('ingredients_state','missing','allergens_state','missing'),
      'observation_metadata',jsonb_build_object('source_revision',1,'source_url','https://world.openfoodfacts.org/product/'||ean,
        'license','ODbL-1.0; contents DbCL-1.0','retrieved_at','2026-09-19T12:00:00Z','source_updated_at',NULL,'validation_findings','[]'::jsonb))) value,
      body.fields FROM body
  ), canonical AS (SELECT value,value::text text,fields FROM payload)
  SELECT jsonb_build_object('external_id',ean,'identity',jsonb_build_object('ean',ean,'brand','V2 fixture','product_name','V2 product','category','Drinks'),
    'source_revision',1,'payload_canonical',canonical.text,'payload_hash',encode(sha256(convert_to(canonical.text,'UTF8')),'hex'),
    'sanitized_payload',canonical.value,'source_url','https://world.openfoodfacts.org/product/'||ean,
    'license','ODbL-1.0; contents DbCL-1.0','retrieved_at','2026-09-19T12:00:00Z','source_updated_at',NULL,
    'validation_findings','[]'::jsonb,'extracted_fields',canonical.fields,'ingredients_state','missing','allergens_state','missing',
    'ingredients',NULL,'allergen_assertions','[]'::jsonb) FROM canonical
$$;

CREATE FUNCTION pg_temp.v2_batch(ean text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('source_key','off_api','country','PL','extractor_version','off-observations-v2',
    'idempotency_key','pgtap-v2-'||ean,'scope',jsonb_build_object('kind','synthetic-v2-boundary'))
$$;

SELECT is(public.ingestion_apply_observation(pg_temp.v2_batch('9900000001000'),pg_temp.v2_record('9900000001000','100g',NULL,'per_100g'))->>'status','accepted','exact 100g accepted');
SELECT is(public.ingestion_apply_observation(pg_temp.v2_batch('9900000001001'),pg_temp.v2_record('9900000001001','100ml',NULL,'per_100ml'))->>'status','accepted','exact 100ml accepted');
SELECT is(public.ingestion_apply_observation(pg_temp.v2_batch('9900000001002'),pg_temp.v2_record('9900000001002',NULL,NULL,'unknown'))->>'status','accepted','missing remains unknown');
SELECT is(public.ingestion_apply_observation(pg_temp.v2_batch('9900000001003'),pg_temp.v2_record('9900000001003','100 g',NULL,'unknown'))->>'status','accepted','malformed remains unknown');
SELECT is(public.ingestion_apply_observation(pg_temp.v2_batch('9900000001004'),pg_temp.v2_record('9900000001004',NULL,'g','unknown'))->>'status','accepted','unit alone cannot establish basis');
SELECT is(public.ingestion_apply_observation(pg_temp.v2_batch('9900000001005'),pg_temp.v2_record('9900000001005','100g','ml','unknown'))->>'status','accepted','conflicting declarations remain unknown');
SELECT throws_ok($$SELECT public.ingestion_apply_observation(pg_temp.v2_batch('9900000001006'),pg_temp.v2_record('9900000001006','100g',NULL,'unknown'))$$,
  'P0001','V2 nutrition basis lacks exact source declaration','v2 caller cannot suppress explicit 100g basis');

SELECT * FROM finish();
ROLLBACK;
