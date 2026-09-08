-- Exact current consumer keys; source fixtures are local and fully rolled back.
BEGIN;
CREATE TEMP TABLE qa_contract_context AS SELECT gen_random_uuid() uid,gen_random_uuid() batch,gen_random_uuid() source,gen_random_uuid() observation;
INSERT INTO auth.users(id) SELECT uid FROM qa_contract_context;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true) FROM qa_contract_context;
INSERT INTO public.user_preferences(user_id,country,diet_preference,preferred_language) SELECT uid,'PL','none','en' FROM qa_contract_context ON CONFLICT(user_id) DO UPDATE SET country='PL',diet_preference='none',preferred_language='en';
CREATE TEMP TABLE qa_contract_product AS WITH added AS (
 INSERT INTO public.products(country,brand,product_name,category)
 SELECT 'PL',uid::text,'Synthetic API contract fixture','Dairy' FROM qa_contract_context RETURNING product_id) SELECT product_id FROM added;
INSERT INTO public.ingestion_batches(id,source_key,country,extractor_version,idempotency_key)
SELECT batch,'off_api','PL','qa-contract',uid::text FROM qa_contract_context;
INSERT INTO public.product_source_records(id,source_key,external_id,country,product_id)
SELECT source,'off_api',uid::text,'PL',product_id FROM qa_contract_context CROSS JOIN qa_contract_product;
INSERT INTO public.product_source_observations(id,source_record_id,batch_id,extractor_version,payload_hash,sanitized_payload,extracted_fields,source_url,license,retrieved_at,status)
SELECT observation,source,batch,'qa-contract',repeat('a',64),'{}',
 '{"salt_100g":{"value":"0.1000","state":"recorded","unit":"g","basis":"per_100g","preparation_state":"as_sold","qualifier":"eq"},"nutri_score_label":{"value":"A","state":"recorded","version":null},"nova_classification":{"value":"4","state":"recorded"}}',
 'https://example.org/synthetic-qa','Synthetic only',now()-interval '1 day','accepted' FROM qa_contract_context;
UPDATE public.product_source_records SET selected_observation_id=c.observation FROM qa_contract_context c WHERE id=c.source;
INSERT INTO public.product_field_provenance(product_id,field_name,source_type,source_url,confidence,observation_id,evidence_state,basis,unit,qualifier,preparation_state)
SELECT product_id,'salt_100g','off_api','https://example.org/synthetic-qa',NULL,observation,'recorded','per_100g','g','eq','as_sold' FROM qa_contract_context CROSS JOIN qa_contract_product;
INSERT INTO public.product_source_assertions(source_record_id,observation_id,kind,position,assertion)
SELECT source,observation,kind,0,body FROM qa_contract_context CROSS JOIN (VALUES
 ('ingredient','{"text":"Synthetic ingredient"}'::jsonb),('contains','{"tag":"milk"}'::jsonb),('traces','{"tag":"gluten"}'::jsonb)) a(kind,body);
CREATE TEMP TABLE qa_contract AS SELECT public.api_product_read_model(ARRAY[product_id],'en') b FROM qa_contract_product;
CREATE TEMP TABLE qa_contract_model AS SELECT b->'products'->0 m FROM qa_contract;
CREATE TEMP TABLE qa_contract_find AS SELECT public.api_find_products((SELECT uid::text FROM qa_contract_context),'{}',1,20,false,'en') b;
CREATE FUNCTION pg_temp.qa_keys(value jsonb,expected text[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(value) k)=(SELECT array_agg(k ORDER BY k) FROM unnest(expected) k);
$$;
CREATE FUNCTION pg_temp.qa_retired(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT value=jsonb_build_object('api_version','2','policy_version','evidence-first-v1','error','refresh_required','status','refresh_required','message','Refresh TryVit to use source-backed product evidence.');
$$;
SELECT '1. legacy product_detail is refresh-only' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_product_detail(-1))) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '2. legacy get_product_profile is refresh-only' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_get_product_profile(-1))) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '3. legacy score_explanation is refresh-only' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_score_explanation(-1))) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '4. legacy data_confidence is refresh-only' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_data_confidence(-1))) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '5. legacy product_provenance is refresh-only' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_product_provenance(-1))) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '6. legacy search_products is refresh-only' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_search_products('test'))) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '7. legacy category_listing is refresh-only' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_category_listing('Dairy'))) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '8. legacy better_alternatives is refresh-only' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_better_alternatives(-1))) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '9. legacy get_products_for_compare is refresh-only' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_get_products_for_compare(ARRAY[1]::bigint[]))) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '10. legacy get_watchlist is refresh-only' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_get_watchlist())) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '11. legacy get_recently_viewed is refresh-only' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_get_recently_viewed())) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '12. legacy get_filter_options is refresh-only' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_get_filter_options())) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '13. canonical envelope keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(b,ARRAY['api_version','policy_version','products','missing_ids']) FROM qa_contract)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '14. canonical product keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m,ARRAY['product_id','product_name','product_name_original','brand','country','category','ean','is_deprecated','image','nutrition','ingredients','allergens','suitability','classifications','sources','evidence','score']) FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '15. nutrition keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'nutrition',ARRAY['calories','total_fat_g','saturated_fat_g','trans_fat_g','carbs_g','sugars_g','fibre_g','protein_g','salt_g']) FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '16. nutrient observation keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'nutrition'->'salt_g',ARRAY['value','unit','basis','preparation_state','state','qualifier','observation_id']) FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '17. source observation keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'sources'->0,ARRAY['observation_id','source_key','source_url','license','retrieved_at','source_updated_at']) FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '18. classification container keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'classifications',ARRAY['nutri_score','nova']) FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '19. Nutri-Score observation keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'classifications'->'nutri_score',ARRAY['value','source','version','observation_id']) FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '20. NOVA observation keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'classifications'->'nova',ARRAY['value','source','observation_id']) FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '21. ingredient container keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'ingredients',ARRAY['state','items']) FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '22. ingredient assertion keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'ingredients'->'items'->0,ARRAY['name','state','observation_id']) FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '23. allergen container keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'allergens',ARRAY['state','contains','traces']) FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '24. contains assertion keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'allergens'->'contains'->0,ARRAY['name','state','observation_id']) FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '25. traces assertion keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'allergens'->'traces'->0,ARRAY['name','state','observation_id']) FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '26. suitability is not inferred positive' AS check_name,CASE WHEN ((SELECT m->'suitability'='{"vegan":"unknown","vegetarian":"unknown"}'::jsonb FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '27. evidence summary keys and actual field count' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'evidence',ARRAY['state','recorded_fields','total_fields','reasons']) AND m->'evidence'->>'recorded_fields'='1' FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '28. retirement marker cannot contain a score' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(m->'score',ARRAY['status','value','model_version','reason']) AND m->'score'->>'status'='retired' AND m->'score'->'value'='null'::jsonb FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '29. old list export has no successful nullable grades' AS check_name,CASE WHEN (pg_temp.qa_retired(public.api_get_list_items((SELECT uid FROM qa_contract_context)))) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '30. classification retains exact observation and unknown version' AS check_name,CASE WHEN ((SELECT m->'classifications'->'nutri_score'->>'observation_id'=(SELECT observation::text FROM qa_contract_context) AND m->'classifications'->'nutri_score'->'version'='null'::jsonb FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '31. source decimal precision and basis survive' AS check_name,CASE WHEN ((SELECT m->'nutrition'->'salt_g'->>'value'='0.1000' AND m->'nutrition'->'salt_g'->>'basis'='per_100g' FROM qa_contract_model)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '32. filter options retain requested context' AS check_name,CASE WHEN (public.api_find_filter_options('PL','en')->>'country'='PL') IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '33. canonical search envelope keys' AS check_name,CASE WHEN ((SELECT pg_temp.qa_keys(b,ARRAY['api_version','policy_version','query','country','language','total','page','pages','page_size','filters_applied','preferences_applied','results']) FROM qa_contract_find)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '34. search contains the same source-linked product' AS check_name,CASE WHEN ((SELECT b->>'total'='1' AND b->'results'->0->>'product_id'=(SELECT product_id::text FROM qa_contract_product) AND b->'results'->0->'classifications'->'nova'->>'observation_id'=(SELECT observation::text FROM qa_contract_context) FROM qa_contract_find)) IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT '35. unsupported search ranking fails closed' AS check_name,CASE WHEN (public.api_find_products(NULL,'{"sort_by":"unhealthiness"}')->>'error'='Unsupported search ordering') IS TRUE THEN 0 ELSE 1 END AS violations;
SELECT set_config('request.jwt.claims','{}',true);
SELECT '36. anonymous canonical read has no product payload' AS check_name,CASE WHEN (public.api_product_read_model(ARRAY[(SELECT product_id FROM qa_contract_product)])='{"error":"Authentication required"}'::jsonb) IS TRUE THEN 0 ELSE 1 END AS violations;
ROLLBACK;
