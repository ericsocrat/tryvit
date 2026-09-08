-- Synthetic temporary projections only. No catalog rows or history are edited.
BEGIN;
SELECT plan(20);
CREATE TEMP TABLE qa_data_fixture AS SELECT
 jsonb_build_object('value',NULL,'state','missing','unit','g','basis','unknown',
 'preparation_state','unknown','qualifier',NULL,'observation_id',NULL) AS missing,
 jsonb_build_object('value','0','state','recorded','unit','g','basis','per_100g',
 'preparation_state','as_sold','qualifier','eq','observation_id','00000000-0000-4000-8000-000000000001') AS recorded;
SELECT ok(pg_temp.qa_field_valid(missing),'explicit missing is valid') FROM qa_data_fixture;
SELECT ok(NOT pg_temp.qa_field_valid(jsonb_set(missing,'{value}','"0"')),'missing cannot become zero') FROM qa_data_fixture;
SELECT ok(pg_temp.qa_field_valid(missing||'{"state":"unverified","value":"12"}'),'legacy value stays unverified unknown basis') FROM qa_data_fixture;
SELECT ok(NOT pg_temp.qa_field_valid(missing||'{"state":"unverified","value":"12","basis":"per_100g"}'),'legacy basis cannot be invented') FROM qa_data_fixture;
SELECT ok(NOT pg_temp.qa_field_valid(recorded||'{"observation_id":null}'),'recorded quantity requires source ID') FROM qa_data_fixture;
CREATE TEMP TABLE qa_math_fixture AS SELECT jsonb_build_object('nutrition',jsonb_build_object('protein_g',recorded,'carbs_g',recorded)) AS model FROM qa_data_fixture;
SELECT ok(pg_temp.qa_fields_comparable(model,ARRAY['protein_g']),'proven per100g exact zero is comparable') FROM qa_math_fixture;
SELECT ok(NOT pg_temp.qa_fields_comparable(jsonb_set(model,'{nutrition,protein_g,basis}','"per_100ml"'),ARRAY['protein_g']),'per100ml does not inherit100g bound') FROM qa_math_fixture;
SELECT ok(NOT pg_temp.qa_fields_comparable(jsonb_set(model,'{nutrition,protein_g,basis}','"per_serving"'),ARRAY['protein_g']),'serving does not inherit100g bound') FROM qa_math_fixture;
SELECT ok(NOT pg_temp.qa_fields_comparable(jsonb_set(model,'{nutrition,protein_g,basis}','"unknown"'),ARRAY['protein_g']),'unknown basis not numerically certified') FROM qa_math_fixture;
SELECT ok(NOT pg_temp.qa_fields_comparable(jsonb_set(model,'{nutrition,protein_g,qualifier}','"lt"'),ARRAY['protein_g']),'upper bound is not exact amount') FROM qa_math_fixture;
SELECT ok(NOT pg_temp.qa_fields_comparable(jsonb_set(model,'{nutrition,carbs_g,basis}','"per_100ml"'),ARRAY['protein_g','carbs_g'],NULL),'mixed denominators not comparable') FROM qa_math_fixture;
SELECT ok(NOT pg_temp.qa_fields_comparable(jsonb_set(model,'{nutrition,carbs_g,preparation_state}','"prepared"'),ARRAY['protein_g','carbs_g'],NULL),'mixed preparations not comparable') FROM qa_math_fixture;
SELECT ok(NOT pg_temp.qa_fields_comparable(jsonb_set(model,'{nutrition,carbs_g,observation_id}','"00000000-0000-4000-8000-000000000002"'),ARRAY['protein_g','carbs_g'],NULL),'different observations not combined') FROM qa_math_fixture;
SELECT ok(pg_temp.qa_fields_comparable(jsonb_set(jsonb_set(model,'{nutrition,protein_g,basis}','"per_100ml"'),'{nutrition,carbs_g,basis}','"per_100ml"'),ARRAY['protein_g','carbs_g'],NULL),'same known volume basis supports relative comparison') FROM qa_math_fixture;
INSERT INTO qa_evidence_products(product_id,country,model)
SELECT -900001,'PL',jsonb_build_object('product_id',-900001,'country','PL','score',jsonb_build_object('status','retired','value',NULL,'reason','unsupported_aggregate'),
 'sources','[]'::jsonb,'classifications','{"nova":{"value":null,"source":null},"nutri_score":{"value":null,"source":null}}'::jsonb,
 'evidence','{"state":"legacy_unverified","recorded_fields":0,"total_fields":9,"reasons":["not_package_verification"]}'::jsonb,
 'nutrition',(SELECT jsonb_object_agg(name,missing||jsonb_build_object('unit',CASE WHEN name='calories' THEN 'kcal' ELSE 'g' END)) FROM unnest(ARRAY['calories','total_fat_g','saturated_fat_g','trans_fat_g','carbs_g','sugars_g','fibre_g','protein_g','salt_g']) name)) FROM qa_data_fixture;
SELECT is((SELECT count(*) FROM qa_evidence_count_violations WHERE product_id=-900001),0::bigint,'all-missing fixture has a valid explicit count');
SAVEPOINT projection;
UPDATE qa_evidence_products SET model=jsonb_set(model,'{score,value}','0') WHERE product_id=-900001;
SELECT ok(EXISTS(SELECT 1 FROM qa_score_violations WHERE product_id=-900001),'fabricated current score detected');
ROLLBACK TO projection;
UPDATE qa_evidence_products SET model=jsonb_set(model,'{evidence,recorded_fields}','9') WHERE product_id=-900001;
SELECT ok(EXISTS(SELECT 1 FROM qa_evidence_count_violations WHERE product_id=-900001),'inflated evidence numerator detected');
ROLLBACK TO projection;
UPDATE qa_evidence_products SET model=jsonb_set(model,'{sources}','[{"observation_id":"00000000-0000-4000-8000-000000000001","source_key":"fixture"}]') WHERE product_id=-900001;
SELECT ok(EXISTS(SELECT 1 FROM qa_source_link_violations WHERE product_id=-900001),'unrelated source ID detected');
ROLLBACK TO projection;
UPDATE qa_evidence_products SET model=jsonb_set(model,'{classifications,nova}','{"value":"1","source":"fixture"}') WHERE product_id=-900001;
SELECT ok(EXISTS(SELECT 1 FROM qa_classification_violations WHERE product_id=-900001),'classification cannot be invented without source');
ROLLBACK TO projection;
SELECT is((SELECT count(*) FROM qa_score_violations WHERE product_id=-900001)+(SELECT count(*) FROM qa_classification_violations WHERE product_id=-900001),0::bigint,'projection mutations rolled back');
SELECT * FROM finish();
ROLLBACK;
