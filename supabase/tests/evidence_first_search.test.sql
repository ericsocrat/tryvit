-- Transaction-scoped synthetic fixtures. Never run against production.
BEGIN;
SELECT no_plan();
SELECT ok(NOT has_function_privilege('anon','public.api_find_products(text,jsonb,integer,integer,boolean,text)','EXECUTE'),'Find rejects anonymous execution');
SELECT is(public.api_find_products()->>'error','Authentication required','missing auth context fails closed');
INSERT INTO auth.users(id,email) VALUES('eeeeeeee-1111-4111-8111-111111111111','find-fixture@test.tryvit.local');
INSERT INTO public.user_preferences(user_id,country,diet_preference,preferred_language)
VALUES('eeeeeeee-1111-4111-8111-111111111111','PL','none','en') ON CONFLICT(user_id) DO UPDATE SET country='PL',diet_preference='none',preferred_language='en';
SELECT set_config('request.jwt.claims','{"sub":"eeeeeeee-1111-4111-8111-111111111111","role":"authenticated"}',true);
INSERT INTO public.products(country,brand,product_name,category,ean,unhealthiness_score,nova_classification) VALUES
('PL','Zxfind fixture','Zxfind Alpha Skyr','Dairy','9910000000119',99,'4'),
('PL','Zxfind fixture','Zxfind Beta Skyr','Dairy','9910000000126',1,'1'),
('DE','Zxfind fixture','Zxfind German Skyr','Dairy','9910000000133',1,'4');
CREATE TEMP TABLE find_fixture AS SELECT product_id,product_name,country FROM public.products WHERE brand='Zxfind fixture';
INSERT INTO public.product_images(product_id,url,source,image_type,is_primary)
SELECT product_id,'https://images.openfoodfacts.org/images/products/fixture/front.jpg','off_api','front',true FROM find_fixture WHERE product_name='Zxfind Alpha Skyr';

CREATE TEMP TABLE find_response AS SELECT public.api_find_products('zxfind','{}',1,1,false,'en') AS body;
SELECT is((SELECT body->>'api_version' FROM find_response),'2','Find has an evidence-first envelope');
SELECT is((SELECT body->>'country' FROM find_response),'PL','saved market is respected');
SELECT is((SELECT (body->>'total')::integer FROM find_response),2,'total is calculated before pagination');
SELECT is((SELECT jsonb_array_length(body->'results') FROM find_response),1,'page size is bounded');
SELECT is((SELECT body->'results'->0->>'product_name' FROM find_response),'Zxfind Alpha Skyr','relevance ties do not use legacy health score');
SELECT is((SELECT body->'results'->0->'score'->'value' FROM find_response),'null'::jsonb,'legacy numeric score never leaks');
SELECT is((SELECT body->'results'->0->'image'->>'url' FROM find_response),'https://images.openfoodfacts.org/images/products/fixture/front.jpg','Find returns the same primary image as detail');
SELECT is((public.api_find_products('zxfind','{"country":"DE"}',1,20,false,'de')->>'total')::integer,1,'explicit DE scope does not mix markets');
SELECT is(public.api_find_products('9910000000119')->'results'->0->>'product_name','Zxfind Alpha Skyr','exact barcode works without preference or nutrition assumptions');
SELECT is((public.api_find_products('zxfind','{}',3,1)->>'total')::integer,2,'an out-of-range page preserves the catalog count');
SELECT is(jsonb_array_length(public.api_find_products('zxfind','{}',3,1)->'results'),0,'out-of-range page is explicitly empty');
SELECT is(public.api_find_products('zxfind','{"max_unhealthiness":20}')->>'error','Unsupported search filters','retired saved criterion is rejected rather than silently ignored');
SELECT is(public.api_find_products('zxfind','{"sort_by":"unhealthiness"}')->>'error','Unsupported search ordering','retired ranking is unavailable');
SELECT is(public.api_find_products('zxfind','{}',1,51)->>'error','Invalid search request','API refuses unbounded page size');
SELECT is(public.api_find_products('foo'' & ! ( : " \\ % _')->>'api_version','2','punctuation never becomes invalid tsquery syntax');
SELECT is((public.api_find_products('zxfind','{"nova_group":["4"]}')->>'total')::integer,0,'legacy-computed NOVA is not source-reported filter evidence');

-- Source assertion and accepted source classification are independent of legacy fields.
INSERT INTO public.ingestion_batches(id,source_key,country,extractor_version,idempotency_key)
VALUES('eeeeeeee-2222-4222-8222-222222222222','off_api','PL','find-fixture','find-fixture');
INSERT INTO public.product_source_records(id,source_key,external_id,country,product_id)
SELECT 'eeeeeeee-3333-4333-8333-333333333333','off_api','find-fixture-beta','PL',product_id FROM find_fixture WHERE product_name='Zxfind Beta Skyr';
INSERT INTO public.product_source_observations(id,source_record_id,batch_id,extractor_version,payload_hash,sanitized_payload,extracted_fields,source_url,license,retrieved_at,status)
VALUES('eeeeeeee-4444-4444-8444-444444444444','eeeeeeee-3333-4333-8333-333333333333','eeeeeeee-2222-4222-8222-222222222222','find-fixture',repeat('a',64),'{}','{"nova_classification":{"value":"4","state":"recorded"}}','https://example.org/find-fixture','Fixture only',now(),'accepted');
UPDATE public.product_source_records SET selected_observation_id='eeeeeeee-4444-4444-8444-444444444444' WHERE id='eeeeeeee-3333-4333-8333-333333333333';
INSERT INTO public.product_source_assertions(source_record_id,observation_id,kind,position,assertion)
VALUES('eeeeeeee-3333-4333-8333-333333333333','eeeeeeee-4444-4444-8444-444444444444','contains',0,'{"tag":"milk"}');
SELECT is((public.api_find_products('zxfind','{"nova_group":["4"]}',1,1)->>'total')::integer,1,'accepted source NOVA filters before pagination');
SELECT is(public.api_find_products('zxfind','{"nova_group":["4"]}')->'results'->0->>'product_name','Zxfind Beta Skyr','NOVA filter and returned classification agree');
SELECT is((public.api_find_products('zxfind','{"allergen_free":["milk"]}')->>'total')::integer,1,'source-owned contains evidence is excluded');
INSERT INTO public.product_allergen_info(product_id,tag,type,evidence_basis)
SELECT product_id,'milk','contains','legacy_unclassified' FROM find_fixture WHERE product_name='Zxfind Alpha Skyr';
SELECT is((public.api_find_products('zxfind','{"allergen_free":["milk"]}')->>'total')::integer,0,'legacy positive contains evidence is also excluded');
UPDATE public.user_preferences SET avoid_allergens=ARRAY['milk'] WHERE user_id='eeeeeeee-1111-4111-8111-111111111111';
SELECT is((public.api_find_products('zxfind')->>'total')::integer,0,'saved allergen preferences cover legacy and source evidence');
UPDATE public.user_preferences SET avoid_allergens=ARRAY[]::text[] WHERE user_id='eeeeeeee-1111-4111-8111-111111111111';
SELECT is((public.api_find_products('zxfind','{"allergen_free":["en:milk"]}')->>'total')::integer,0,'legacy wire allergen prefixes retain their exclusion meaning');
INSERT INTO public.product_allergen_info(product_id,tag,type,evidence_basis)
SELECT product_id,'peanuts','traces','legacy_unclassified' FROM find_fixture WHERE product_name='Zxfind Alpha Skyr';
INSERT INTO public.product_source_assertions(source_record_id,observation_id,kind,position,assertion)
VALUES('eeeeeeee-3333-4333-8333-333333333333','eeeeeeee-4444-4444-8444-444444444444','traces',0,'{"tag":"peanuts"}');
UPDATE public.user_preferences SET avoid_allergens=ARRAY['peanuts'],treat_may_contain_as_unsafe=false WHERE user_id='eeeeeeee-1111-4111-8111-111111111111';
SELECT is((public.api_find_products('zxfind')->>'total')::integer,2,'may-contain handling follows the saved setting');
UPDATE public.user_preferences SET treat_may_contain_as_unsafe=true WHERE user_id='eeeeeeee-1111-4111-8111-111111111111';
SELECT is((public.api_find_products('zxfind')->>'total')::integer,0,'may-contain exclusions include legacy and source evidence');
UPDATE public.user_preferences SET avoid_allergens=ARRAY[]::text[],treat_may_contain_as_unsafe=false WHERE user_id='eeeeeeee-1111-4111-8111-111111111111';
INSERT INTO public.product_source_assertions(source_record_id,observation_id,kind,position,assertion)
VALUES('eeeeeeee-3333-4333-8333-333333333333','eeeeeeee-4444-4444-8444-444444444444','traces',1,'{"tag":"en:sesame-seeds"}');
INSERT INTO public.product_allergen_info(product_id,tag,type,evidence_basis)
SELECT product_id,'sesame','traces','legacy_unclassified' FROM find_fixture WHERE product_name='Zxfind Alpha Skyr';
UPDATE public.user_preferences SET avoid_allergens=ARRAY['sesame'],treat_may_contain_as_unsafe=true WHERE user_id='eeeeeeee-1111-4111-8111-111111111111';
SELECT is((public.api_find_products('zxfind')->>'total')::integer,0,'canonical sesame preference matches source aliases and canonical legacy traces');
UPDATE public.user_preferences SET avoid_allergens=ARRAY[]::text[],treat_may_contain_as_unsafe=false WHERE user_id='eeeeeeee-1111-4111-8111-111111111111';
SELECT ok(EXISTS(SELECT 1 FROM jsonb_array_elements(
  public.api_product_read_model(ARRAY[(SELECT product_id FROM find_fixture WHERE product_name='Zxfind Beta Skyr')])->'products'->0->'allergens'->'traces') a
  WHERE a->>'name'='sesame'),'displayed allergen and preference filter use the same key');
SELECT is((SELECT count(*)::integer FROM public.user_product_lists WHERE user_id='eeeeeeee-1111-4111-8111-111111111111' AND list_type='avoid'),1,'disposable fixture has its existing default avoid list');
INSERT INTO public.user_product_list_items(list_id,product_id) SELECT l.id,p.product_id FROM find_fixture p CROSS JOIN public.user_product_lists l
WHERE p.product_name='Zxfind Alpha Skyr' AND l.user_id='eeeeeeee-1111-4111-8111-111111111111' AND l.list_type='avoid';
SELECT is((public.api_find_products('zxfind')->>'total')::integer,1,'avoid-list entries are excluded by default');
SELECT is((public.api_find_products('zxfind','{}',1,20,true)->>'total')::integer,2,'explicit include-avoided restores the same product, not a substitute');
UPDATE public.user_preferences SET avoid_allergens=ARRAY['peanuts'],strict_allergen=true WHERE user_id='eeeeeeee-1111-4111-8111-111111111111';
SELECT is((public.api_find_products('zxfind')->>'total')::integer,0,'strict unknown does not treat unrelated positive evidence as assessed absence');
UPDATE public.user_preferences SET avoid_allergens=ARRAY[]::text[],strict_allergen=false,diet_preference='vegan',strict_diet=true WHERE user_id='eeeeeeee-1111-4111-8111-111111111111';
SELECT is((public.api_find_products('zxfind')->>'total')::integer,0,'strict dietary uncertainty never becomes vegan yes');
SELECT is((public.api_find_products('zxfind')->>'preferences_applied')::boolean,true,'preference scope remains visible with no eligible results');
SELECT is(public.api_find_filter_options('DE','de')->>'country','DE','filter choices use requested market');
SELECT ok(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.api_find_filter_options('DE','de')->'categories') c WHERE COALESCE(c->>'slug','')=''),'filter choices expose actual category slugs');
INSERT INTO public.api_rate_limit_log(user_id,endpoint) SELECT 'eeeeeeee-1111-4111-8111-111111111111','api_search_products' FROM generate_series(1,30);
SELECT is(public.api_find_products('zxfind')->>'error','rate_limit_exceeded','v2 shares the established rate limit rather than bypassing it');
SELECT * FROM finish();
ROLLBACK;
