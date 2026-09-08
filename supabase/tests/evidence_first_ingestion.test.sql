-- Synthetic fixtures only. Run against isolated migrated database, never prod.
BEGIN;
SELECT no_plan();

SELECT has_table('public','product_source_observations','immutable observations exist');
SELECT ok(NOT has_function_privilege('authenticated','public.ingestion_apply_observation(jsonb,jsonb)','EXECUTE'),
  'clients cannot invoke ingestion');
SELECT ok(NOT has_table_privilege('authenticated','public.product_source_observations','SELECT'),
  'raw observations are not publicly readable');

-- Test envelope sealer only: raw source inputs still must be explicitly supplied.
CREATE FUNCTION pg_temp.seal_test_observation(r jsonb) RETURNS jsonb LANGUAGE sql AS $$
  WITH body AS (SELECT r->'sanitized_payload' || jsonb_build_object(
    'extractor_version','off-observations-v1','extraction',r->'extracted_fields','projected_identity',r->'identity',
    'ingredient_assertions',COALESCE(r->'ingredients','null'::jsonb),
    'allergen_assertions',COALESCE(r->'allergen_assertions','[]'::jsonb),
    'set_states',jsonb_build_object('ingredients_state',COALESCE(r->>'ingredients_state','missing'),
      'allergens_state',COALESCE(r->>'allergens_state','missing')),
    'observation_metadata',jsonb_build_object('source_revision',r->'source_revision','source_url',r->'source_url',
      'license',r->'license','retrieved_at',r->'retrieved_at','source_updated_at',r->'source_updated_at',
      'validation_findings',r->'validation_findings')) AS payload)
  SELECT r || jsonb_build_object('sanitized_payload',payload,'payload_canonical',payload::text,
    'payload_hash',encode(sha256(convert_to(payload::text,'UTF8')),'hex')) FROM body
$$;
CREATE FUNCTION pg_temp.test_observation(ean text,revision integer,fat text DEFAULT '1.1234',
  country text DEFAULT 'PL',title text DEFAULT 'Evidence Fixture') RETURNS jsonb
LANGUAGE sql AS $$
  WITH payload AS (SELECT jsonb_build_object('code',ean,'rev',revision,'nutriments',jsonb_build_object('fat_100g',fat),
    'brands','pgTAP evidence','product_name',title,'ingredients',jsonb_build_array(jsonb_build_object('id','en:milk','text','milk')),
    'allergens_tags',jsonb_build_array('en:milk'),'traces_tags','[]'::jsonb)::text AS canonical),
  missing AS (SELECT jsonb_object_agg(k,jsonb_build_object('value',NULL,'unit','g','basis','unknown',
    'preparation_state','as_sold','state','missing','qualifier',NULL)) AS fields
    FROM unnest(ARRAY['calories_100g','saturated_fat_100g','trans_fat_100g','carbs_100g',
      'sugars_100g','fiber_100g','protein_100g','salt_100g']) k)
  SELECT pg_temp.seal_test_observation(jsonb_build_object('external_id',ean,'identity',jsonb_build_object('ean',ean,'brand','pgTAP evidence',
    'product_name',title,'category','Dairy'), 'source_revision',revision,'payload_canonical',canonical,
    'payload_hash',encode(sha256(convert_to(canonical,'UTF8')),'hex'),'sanitized_payload',canonical::jsonb,
    'source_url','https://world.openfoodfacts.org/product/'||ean,'license','ODbL-1.0',
    'retrieved_at',now(),'source_updated_at',NULL,'validation_findings','[]'::jsonb,
    'extracted_fields',missing.fields || jsonb_build_object('fat_100g',jsonb_build_object('value',fat,'unit','g',
      'basis','per_100g','preparation_state','as_sold','state','recorded','qualifier','eq',
      'source_field','fat_100g','transformation','off_normalized_value'),
      'brand',jsonb_build_object('value','pgTAP evidence','state','recorded','source_field','brands','transformation','off_primary_brand_v1'),
      'product_name',jsonb_build_object('value',title,'state',CASE WHEN title IS NULL THEN 'missing' ELSE 'recorded' END,
        'source_field','product_name','transformation','off_product_name_v1')),
    'ingredients_state','reported','allergens_state','reported',
    'ingredients',jsonb_build_array(jsonb_build_object('id','en:milk','text','milk')),
    'allergen_assertions',jsonb_build_array(jsonb_build_object('tag','milk','type','contains'))))
  FROM payload CROSS JOIN missing
$$;
CREATE FUNCTION pg_temp.test_batch(country text DEFAULT 'PL') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('source_key','off_api','country',country,'extractor_version','off-observations-v1',
    'idempotency_key','pgtap-evidence-'||country,'scope',jsonb_build_object('kind','partial_upsert'))
$$;
CREATE FUNCTION pg_temp.test_missing_sets(r jsonb,reported boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS $$
 SELECT pg_temp.seal_test_observation(r || jsonb_build_object(
   'sanitized_payload',r->'sanitized_payload' || '{"ingredients":null,"allergens_tags":[],"traces_tags":[]}'::jsonb,
   'ingredients',NULL,'allergen_assertions','[]'::jsonb,'ingredients_state','missing',
   'allergens_state',CASE WHEN reported THEN 'reported' ELSE 'missing' END))
$$;

CREATE TEMP TABLE fixture_results(label text PRIMARY KEY,result jsonb);
INSERT INTO fixture_results VALUES('first',public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.test_observation('9900000000010',2)));
SELECT is((SELECT result->>'status' FROM fixture_results WHERE label='first'),'accepted','valid observation selected');
SELECT is((SELECT nf.total_fat_g FROM public.nutrition_facts nf
  JOIN fixture_results r ON nf.product_id=(r.result->>'product_id')::bigint WHERE r.label='first'),1.1234::numeric,
  'precision preserved until display');
SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),pg_temp.test_observation('9900000000010',2))->>'status',
  'duplicate','replay is idempotent');
SELECT is((SELECT count(*) FROM public.product_source_observations WHERE source_record_id IN
  (SELECT id FROM public.product_source_records WHERE external_id='9900000000010')),1::bigint,'one immutable snapshot');
SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),pg_temp.test_observation('9900000000010',1))->>'status',
  'superseded','older revision cannot replace selected values');
SELECT is((SELECT o.source_revision FROM public.product_source_records s
  JOIN public.product_source_observations o ON o.id=s.selected_observation_id
  WHERE s.external_id='9900000000010' AND s.country='PL'),2::bigint,'selected revision remains newer');

INSERT INTO fixture_results VALUES('renamed',public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.test_observation('9900000000010',3,'0.125','PL','Renamed Evidence Fixture')));
SELECT is((SELECT result->>'product_id' FROM fixture_results WHERE label='renamed'),
  (SELECT result->>'product_id' FROM fixture_results WHERE label='first'),'rename preserves product ID');
INSERT INTO fixture_results VALUES('de',public.ingestion_apply_observation(pg_temp.test_batch('DE'),
  pg_temp.test_observation('9900000000010',2,'2','DE')));
SELECT isnt((SELECT result->>'product_id' FROM fixture_results WHERE label='de'),
  (SELECT result->>'product_id' FROM fixture_results WHERE label='first'),'same barcode separate market');
SELECT is((SELECT count(*) FROM public.products WHERE ean='9900000000010'),2::bigint,'other market barcode not cleared');

SELECT throws_ok($$UPDATE public.product_source_observations SET license='changed'
  WHERE id=(SELECT (result->>'observation_id')::uuid FROM fixture_results WHERE label='first')$$,
  'P0001','Source observations are immutable; append and select another observation','history cannot be overwritten');

-- Partial refresh does not treat omission as deletion, nor change saved IDs.
INSERT INTO public.products(country,ean,brand,product_name,category)
SELECT 'PL','991'||lpad(i::text,10,'0'),'pgTAP batch','Batch '||i,'Dairy' FROM generate_series(1,100) i;
CREATE TEMP TABLE original_batch AS SELECT product_id,ean FROM public.products WHERE brand='pgTAP batch';
SELECT public.ingestion_upsert_product('PL','991'||lpad(i::text,10,'0'),'pgTAP batch','Batch '||i,'Dairy')
  FROM generate_series(1,30) i;
SELECT is((SELECT count(*) FROM original_batch b JOIN public.products p USING(product_id)
  WHERE p.ean=b.ean AND p.is_deprecated IS NOT TRUE),100::bigint,'refresh30 preserves all100 IDs/barcodes/status');

-- Unknown/censored fields remain typed, and do not become exact nutrition.
INSERT INTO fixture_results VALUES('censored',public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.seal_test_observation(jsonb_set(jsonb_set(pg_temp.test_observation('9900000000027',1,'0.1','PL','Censored Fixture'),
    '{extracted_fields,fat_100g,qualifier}','"lt"'::jsonb),'{sanitized_payload,nutriments,fat_modifier}','"<"'::jsonb))));
SELECT ok((SELECT nf.total_fat_g IS NULL FROM public.nutrition_facts nf JOIN fixture_results r
  ON nf.product_id=(r.result->>'product_id')::bigint WHERE r.label='censored'),'less-than value is not exact');
SELECT is((SELECT pf.qualifier FROM public.product_field_provenance pf JOIN fixture_results r
  ON pf.product_id=(r.result->>'product_id')::bigint WHERE r.label='censored' AND pf.field_name='fat_100g'),
  'lt','qualifier retained');

-- Selection cannot point at another product/source's observation.
SELECT throws_ok($$UPDATE public.product_source_records SET selected_observation_id=
  (SELECT (result->>'observation_id')::uuid FROM fixture_results WHERE label='censored')
  WHERE external_id='9900000000010' AND country='PL'$$,
  '23503',NULL,'selection ownership enforced by composite FK');

-- Replacing a source's set does not append duplicate translations or positions.
INSERT INTO fixture_results VALUES('replacement',public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.seal_test_observation(jsonb_set(jsonb_set(pg_temp.test_observation('9900000000010',4,'0.125','PL','Renamed Evidence Fixture'),
    '{ingredients}','[{"id":"en:milk","text":"Mleko"}]'::jsonb),
    '{sanitized_payload,ingredients}','[{"id":"en:milk","text":"Mleko"}]'::jsonb))));
SELECT is((SELECT count(*) FROM public.product_source_assertions a
  JOIN public.product_source_records s ON s.id=a.source_record_id
  WHERE s.external_id='9900000000010' AND s.country='PL' AND a.kind='ingredient'),1::bigint,
  'source ingredient snapshot is replaced, not appended');
SELECT is((SELECT a.assertion->>'text' FROM public.product_source_assertions a
  JOIN public.product_source_records s ON s.id=a.source_record_id
  WHERE s.external_id='9900000000010' AND s.country='PL' AND a.kind='ingredient'),'Mleko',
  'new source spelling selected without claiming two ingredients');

-- A manual selected field is not overwritten by an OFF refresh.
INSERT INTO fixture_results VALUES('missing-sets',public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.test_missing_sets(pg_temp.test_observation('9900000000010',5,'0.125','PL','Renamed Evidence Fixture'))));
SELECT is((SELECT result->>'status' FROM fixture_results WHERE label='missing-sets'),'accepted',
  'incomplete ingredient/allergen fetch can refresh valid nutrients');
SELECT is((SELECT count(*) FROM public.product_source_assertions a JOIN public.product_source_records s ON s.id=a.source_record_id
  WHERE s.external_id='9900000000010' AND s.country='PL'),2::bigint,'missing sets preserve old ingredient and positive warning');
SELECT ok((SELECT bool_and(a.observation_id <> s.selected_observation_id) FROM public.product_source_assertions a
  JOIN public.product_source_records s ON s.id=a.source_record_id WHERE s.external_id='9900000000010' AND s.country='PL'),
  'retained assertions preserve original observation age');
UPDATE public.product_field_provenance SET source_type='manual',observation_id=NULL
 WHERE product_id=(SELECT (result->>'product_id')::bigint FROM fixture_results WHERE label='first')
   AND field_name='fat_100g';
SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.test_observation('9900000000010',6,'2','PL','Renamed Evidence Fixture'))->>'status',
  'quarantined','independent field ownership requires reconciliation');
SELECT is((SELECT nf.total_fat_g FROM public.nutrition_facts nf JOIN fixture_results r
  ON nf.product_id=(r.result->>'product_id')::bigint WHERE r.label='first'),0.125::numeric,
  'quarantined refresh does not change nutrient projection');

UPDATE public.nutrition_facts SET salt_g=0.7
 WHERE product_id=(SELECT (result->>'product_id')::bigint FROM fixture_results WHERE label='first');
UPDATE public.product_field_provenance SET source_type='manual',observation_id=NULL
 WHERE product_id=(SELECT (result->>'product_id')::bigint FROM fixture_results WHERE label='first')
   AND field_name='salt_100g';
SELECT throws_ok($$SELECT public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.test_observation('9900000000010',7,'2','PL','Renamed Evidence Fixture') #- '{extracted_fields,salt_100g}')$$,
  'P0001','Incomplete canonical nutrient envelope','omitted owned nutrient rejects incomplete envelope');
SELECT is((SELECT nf.salt_g FROM public.nutrition_facts nf JOIN fixture_results r
  ON nf.product_id=(r.result->>'product_id')::bigint WHERE r.label='first'),0.7::numeric,
  'omitted manual-owned nutrient is not erased');

-- Empty serializer defaults cannot erase prior positive evidence.
UPDATE public.product_field_provenance SET source_type='off_api'
 WHERE product_id=(SELECT (result->>'product_id')::bigint FROM fixture_results WHERE label='first');
SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.test_missing_sets(pg_temp.test_observation('9900000000010',8,'0.125','PL','Renamed Evidence Fixture'),true))->>'status',
  'accepted','empty defaults do not block unrelated nutrient refresh');
SELECT is((SELECT count(*) FROM public.product_source_assertions a JOIN public.product_source_records s ON s.id=a.source_record_id
  WHERE s.external_id='9900000000010' AND s.country='PL' AND a.kind='contains' AND a.assertion->>'tag'='milk'),
  1::bigint,'empty allergen defaults with missing ingredients retain milk warning');

-- Invalid records are retained, not selected; a valid peer still commits.
SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.test_observation('9900000000034',1,'1000','PL','Invalid fat fixture'))->>'status',
  'quarantined','fat1000 bypassing Python quarantines at service boundary');
SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.seal_test_observation(pg_temp.test_observation('9900000000041',1,'1','PL','Invalid time fixture') ||
    jsonb_build_object('source_updated_at',now()+interval '1 day')))->>'status',
  'quarantined','future source timestamp quarantines without losing evidence');
SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.test_observation('9900000000058',1,'1','PL','Valid peer fixture'))->>'status',
  'accepted','valid peer in same bounded batch still applies');
SELECT is((SELECT count(*) FROM public.product_source_records WHERE external_id IN('9900000000034','9900000000041')
  AND selected_observation_id IS NULL),2::bigint,'invalid observations do not become selected/fresh');
SELECT is((SELECT count(*) FROM public.product_source_observations o JOIN public.product_source_records s ON s.id=o.source_record_id
  WHERE s.external_id IN('9900000000034','9900000000041') AND o.status='quarantined' AND jsonb_array_length(o.validation_findings)>0),
  2::bigint,'bad numeric and future timestamp observations retained with findings');
SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.seal_test_observation(jsonb_set(jsonb_set(pg_temp.test_observation('9900000000065',1,'0.1','PL','Approximate fixture'),
    '{extracted_fields,fat_100g,qualifier}','"approx"'::jsonb),'{sanitized_payload,nutriments,fat_modifier}','"~"'::jsonb)))->>'status',
  'accepted','approximate source quantity accepted as qualified evidence');
SELECT is((SELECT pf.qualifier FROM public.product_field_provenance pf JOIN public.products p USING(product_id)
  WHERE p.ean='9900000000065' AND p.country='PL' AND pf.field_name='fat_100g'),'approx','approx qualifier retained');
SELECT ok((SELECT nf.total_fat_g IS NULL FROM public.nutrition_facts nf JOIN public.products p USING(product_id)
  WHERE p.ean='9900000000065' AND p.country='PL'),'approximate quantity does not become exact projection');

-- Real envelope tampering must fail before any current field/identity mutation.
SELECT throws_ok($$SELECT public.ingestion_apply_observation(pg_temp.test_batch(),
  jsonb_set(pg_temp.test_observation('9900000000010',9),'{external_id}','"9900000000999"'))$$,
  'P0001','Invalid observation envelope','external identity cannot detach from hashed raw barcode');
SELECT throws_ok($$SELECT public.ingestion_apply_observation(pg_temp.test_batch(),
  jsonb_set(pg_temp.test_observation('9900000000010',9),'{ingredients}','[{"id":"en:wheat"}]'))$$,
  'P0001','Invalid observation envelope','unhashed ingredient assertion rejected');
SELECT throws_ok($$SELECT public.ingestion_apply_observation(pg_temp.test_batch(),
  jsonb_set(pg_temp.test_observation('9900000000010',9),'{allergen_assertions}','[{"tag":"gluten","type":"contains"}]'))$$,
  'P0001','Invalid observation envelope','unhashed allergen assertion rejected');
SELECT throws_ok($$SELECT public.ingestion_apply_observation(pg_temp.test_batch(),
  jsonb_set(pg_temp.test_observation('9900000000010',9),'{extracted_fields,fat_100g,value}','"99"'))$$,
  'P0001','Invalid observation envelope','unhashed normalized field rejected');
SELECT throws_ok($$SELECT public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.seal_test_observation(pg_temp.test_observation('9900000000010',9) #- '{sanitized_payload,nutriments,fat_100g}'))$$,
  'P0001','Recorded field lacks bound source input','recorded nutrient requires retained raw input even after resealing');
SELECT throws_ok($$SELECT public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.seal_test_observation(jsonb_set(pg_temp.test_observation('9900000000010',9),'{ingredients}','[{"id":"en:wheat"}]')))$$,
  'P0001','Assertions lack bound source input','resealing cannot turn raw milk into unsupported wheat assertion');

SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),pg_temp.seal_test_observation(
  jsonb_set(jsonb_set(jsonb_set(pg_temp.test_observation('9900000000010',9,'0.125','PL','Renamed Evidence Fixture'),
    '{identity,brand}','null'::jsonb),'{sanitized_payload,brands}','null'::jsonb),
    '{extracted_fields,brand}','{"value":null,"state":"missing","source_field":"brands","transformation":"off_primary_brand_v1"}'::jsonb)))->>'status',
  'quarantined','missing raw brand refresh quarantines instead of overwriting known brand');
SELECT is((SELECT brand FROM public.products WHERE ean='9900000000010' AND country='PL'),'pgTAP evidence',
  'known brand survives missing source brand');
SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),
  pg_temp.test_observation('9900000000010',10,'0.125','PL',NULL))->>'status','quarantined','missing raw name refresh quarantines');
SELECT is((SELECT product_name FROM public.products WHERE ean='9900000000010' AND country='PL'),'Renamed Evidence Fixture',
  'known name survives missing source name');

SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),pg_temp.test_observation('9900000000454',1))->>'status',
  'accepted','positive allergen fixture accepted');
SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),pg_temp.seal_test_observation(
  pg_temp.test_observation('9900000000454',2) || jsonb_build_object(
    'sanitized_payload',pg_temp.test_observation('9900000000454',2)->'sanitized_payload'
      || '{"ingredients":null,"allergens_tags":[""],"traces_tags":[]}'::jsonb,
    'ingredients',null,'ingredients_state','missing',
    'allergen_assertions','[{"tag":"","type":"contains"}]'::jsonb)))->>'status',
  'quarantined','blank allergen tag quarantines even without adapter validation finding');
SELECT is((SELECT count(*) FROM public.product_source_assertions a JOIN public.product_source_records s ON s.id=a.source_record_id
  WHERE s.external_id='9900000000454' AND a.kind='contains' AND a.assertion->>'tag'='milk'),1::bigint,
  'malformed allergen refresh preserves original positive milk assertion');
SELECT is(public.ingestion_apply_observation(pg_temp.test_batch(),pg_temp.seal_test_observation(
  pg_temp.test_observation('9900000000454',3) || jsonb_build_object(
    'sanitized_payload',pg_temp.test_observation('9900000000454',3)->'sanitized_payload'
      || '{"ingredients":null,"allergens_tags":["en:none"],"traces_tags":[]}'::jsonb,
    'ingredients',null,'ingredients_state','missing',
    'allergen_assertions','[{"tag":"none","type":"contains"}]'::jsonb)))->>'status',
  'accepted','absence sentinel with incomplete ingredients does not block other fields');
SELECT is((SELECT count(*) FROM public.product_source_assertions a JOIN public.product_source_records s ON s.id=a.source_record_id
  WHERE s.external_id='9900000000454' AND a.kind='contains' AND a.assertion->>'tag'='milk'),1::bigint,
  'absence sentinel cannot erase a retained positive allergen without collected ingredient snapshot');

SELECT * FROM finish();
ROLLBACK;
