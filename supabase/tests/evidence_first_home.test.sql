-- Synthetic owner-scoped fixtures, entirely rolled back. Never production.
BEGIN;
SELECT no_plan();
SELECT ok(NOT has_function_privilege('anon','public.api_home_read_model(text)','EXECUTE'),'anonymous Home access is denied');
SELECT is(public.api_home_read_model()->>'error','Authentication required','missing auth context fails closed');
SELECT is(public.api_get_dashboard_data()->>'status','refresh_required','legacy Home requires refresh, not score null coercion');
SELECT ok(NOT (public.api_get_dashboard_data() ? 'stats'),'retired Home emits no misleading statistics');
INSERT INTO auth.users(id,email) VALUES
('ffffffff-1111-4111-8111-111111111111','home-owner@test.tryvit.local'),
('ffffffff-2222-4222-8222-222222222222','home-other@test.tryvit.local');
INSERT INTO public.user_preferences(user_id,country,avoid_allergens,treat_may_contain_as_unsafe)
VALUES ('ffffffff-1111-4111-8111-111111111111','PL',ARRAY['tree-nuts','lupin','sesame','sulphites'],false),
('ffffffff-2222-4222-8222-222222222222','DE',ARRAY['milk'],false)
ON CONFLICT(user_id) DO UPDATE SET country=EXCLUDED.country,avoid_allergens=EXCLUDED.avoid_allergens,treat_may_contain_as_unsafe=EXCLUDED.treat_may_contain_as_unsafe;
SELECT set_config('request.jwt.claims','{"sub":"ffffffff-1111-4111-8111-111111111111","role":"authenticated"}',true);
INSERT INTO public.products(country,brand,product_name,category,unhealthiness_score)
SELECT 'PL','Zxhome fixture','Zxhome product '||n,'Dairy',CASE WHEN n%2=0 THEN 1 ELSE 99 END FROM generate_series(1,10) n;
CREATE TEMP TABLE home_products AS SELECT product_id,(substring(product_name FROM '[0-9]+$'))::integer n FROM public.products WHERE brand='Zxhome fixture';
UPDATE public.products SET is_deprecated=true WHERE product_id=(SELECT product_id FROM home_products WHERE n=2);
INSERT INTO public.user_product_views(user_id,product_id,viewed_at)
SELECT 'ffffffff-1111-4111-8111-111111111111',product_id,now()-n*interval '1 minute' FROM home_products;
INSERT INTO public.user_product_list_items(list_id,product_id,position,added_at)
SELECT l.id,p.product_id,p.n,'2025-01-01T12:00:00Z'::timestamptz FROM home_products p CROSS JOIN public.user_product_lists l
WHERE l.user_id='ffffffff-1111-4111-8111-111111111111' AND l.list_type='favorites';
INSERT INTO public.user_product_lists(user_id,list_type,name) VALUES('ffffffff-1111-4111-8111-111111111111','custom','Home custom fixture');
INSERT INTO public.scan_history(user_id,ean,found) VALUES('ffffffff-1111-4111-8111-111111111111','9910000000990',false);
INSERT INTO public.product_images(product_id,url,source,image_type,is_primary)
SELECT product_id,'https://images.openfoodfacts.org/images/products/home-fixture/front.jpg','off_api','front',true FROM home_products WHERE n=1;
CREATE TEMP TABLE initial_home AS SELECT public.api_home_read_model('en') body;
SELECT is((SELECT body->>'api_version' FROM initial_home),'2','Home uses the evidence-first envelope');
SELECT is((SELECT (body->'stats'->>'total_viewed')::integer FROM initial_home),10,'view count retains all owned records');
SELECT is((SELECT jsonb_array_length(body->'recently_viewed') FROM initial_home),8,'canonical recent projection is bounded to eight');
SELECT is((SELECT (body->'stats'->>'favorites_count')::integer FROM initial_home),10,'favorite count precedes bounded projection');
SELECT is((SELECT jsonb_array_length(body->'favorites_preview') FROM initial_home),6,'canonical favorite preview is bounded to six');
SELECT is((SELECT (body->'stats'->>'total_scanned')::integer FROM initial_home),1,'unsuccessful scan history is still counted as activity');
SELECT is((SELECT (body->'stats'->>'custom_lists_count')::integer FROM initial_home),1,'custom lists are counted explicitly, not inferred from two system lists');
SELECT is((SELECT body->'recently_viewed'->0->'product'->>'product_name' FROM initial_home),'Zxhome product 1','recent order is viewing time, not score');
SELECT is((SELECT body->'favorites_preview'->0->'product'->>'product_name' FROM initial_home),'Zxhome product 1','favorite order is saved position, not score');
SELECT is((SELECT body->'recently_viewed'->0->'product'->'score'->'value' FROM initial_home),'null'::jsonb,'recent consumer aggregate is retired');
SELECT is((SELECT body->'favorites_preview'->1->'product'->'score'->'value' FROM initial_home),'null'::jsonb,'a low legacy score cannot become a current favorable favorite score');
SELECT is((SELECT (body->'favorites_preview'->1->'product'->>'is_deprecated')::boolean FROM initial_home),true,'archived favorites remain visible');
SELECT is((SELECT body->'recently_viewed'->0->'product'->'image'->>'url' FROM initial_home),'https://images.openfoodfacts.org/images/products/home-fixture/front.jpg','Home uses the same canonical photo as detail');
SELECT is((SELECT body->'recently_viewed'->0->'product'->'evidence'->>'state' FROM initial_home),'legacy_unverified','unattributed legacy facts are not upgraded to verified');
SELECT is(public.api_home_read_model('de')->>'language','de','requested language is explicit');
SELECT is(public.api_home_read_model('invalid')->>'error','Unsupported language','unsupported language is rejected');

-- Positive assertions beyond the visible favorite preview still count.
INSERT INTO public.product_allergen_info(product_id,tag,type,evidence_basis)
SELECT product_id,CASE n WHEN 1 THEN 'milk' WHEN 2 THEN 'lupin' WHEN 3 THEN 'sulphites' ELSE 'none' END,
CASE n WHEN 3 THEN 'traces' ELSE 'contains' END,'legacy_unclassified' FROM home_products WHERE n IN (1,2,3);
INSERT INTO public.ingestion_batches(id,source_key,country,extractor_version,idempotency_key)
VALUES('ffffffff-3333-4333-8333-333333333333','off_api','PL','home-fixture','home-fixture');
INSERT INTO public.product_source_records(id,source_key,external_id,country,product_id)
SELECT 'ffffffff-4444-4444-8444-444444444444','off_api','home-fixture-9','PL',product_id FROM home_products WHERE n=9;
INSERT INTO public.product_source_observations(id,source_record_id,batch_id,extractor_version,payload_hash,sanitized_payload,extracted_fields,source_url,license,retrieved_at,status)
VALUES('ffffffff-5555-4555-8555-555555555555','ffffffff-4444-4444-8444-444444444444','ffffffff-3333-4333-8333-333333333333','home-fixture',repeat('b',64),'{}','{}','https://example.org/home-fixture','Fixture only',now(),'accepted');
UPDATE public.product_source_records SET selected_observation_id='ffffffff-5555-4555-8555-555555555555' WHERE id='ffffffff-4444-4444-8444-444444444444';
INSERT INTO public.product_source_assertions(source_record_id,observation_id,kind,position,assertion) VALUES
('ffffffff-4444-4444-8444-444444444444','ffffffff-5555-4555-8555-555555555555','contains',0,'{"tag":"en:nuts"}'),
('ffffffff-4444-4444-8444-444444444444','ffffffff-5555-4555-8555-555555555555','contains',1,'{"tag":"none"}'),
('ffffffff-4444-4444-8444-444444444444','ffffffff-5555-4555-8555-555555555555','traces',0,'{"tag":"en:sesame-seeds"}');
CREATE TEMP TABLE home_matches AS SELECT public.api_home_read_model() body;
SELECT is((SELECT (body->'saved_allergen_matches'->>'count')::integer FROM home_matches),2,'distinct products match combined source and legacy positive evidence');
SELECT is((SELECT body->'saved_allergen_matches'->>'state' FROM home_matches),'checked','completed match check is explicit');
SELECT ok(EXISTS(SELECT 1 FROM home_matches,jsonb_array_elements(body->'saved_allergen_matches'->'products') p WHERE p->'product'->>'product_name'='Zxhome product 9'),'warning beyond first six favorites is not lost');
SELECT is((SELECT p->'matches'->0->>'allergen' FROM home_matches,jsonb_array_elements(body->'saved_allergen_matches'->'products') p WHERE p->'product'->>'product_name'='Zxhome product 9'),'tree-nuts','OFF nuts alias matches canonical tree-nuts preference');
SELECT is((SELECT p->'matches'->0->>'state' FROM home_matches,jsonb_array_elements(body->'saved_allergen_matches'->'products') p WHERE p->'product'->>'product_name'='Zxhome product 9'),'recorded','selected source assertion retains its attribution state');
SELECT is((SELECT p->'matches'->0->>'observation_id' FROM home_matches,jsonb_array_elements(body->'saved_allergen_matches'->'products') p WHERE p->'product'->>'product_name'='Zxhome product 9'),'ffffffff-5555-4555-8555-555555555555','source match resolves to the actual observation');
SELECT is((SELECT p->'matches'->0->>'state' FROM home_matches,jsonb_array_elements(body->'saved_allergen_matches'->'products') p WHERE p->'product'->>'product_name'='Zxhome product 2'),'unverified','archived legacy positive is preserved without manufactured verification');
SELECT ok(NOT EXISTS(SELECT 1 FROM home_matches,jsonb_array_elements(body->'saved_allergen_matches'->'products') p,jsonb_array_elements(p->'matches') a WHERE a->>'kind'='traces'),'disabled may-contain preference is respected');
UPDATE public.user_preferences SET treat_may_contain_as_unsafe=true WHERE user_id='ffffffff-1111-4111-8111-111111111111';
SELECT is((public.api_home_read_model()->'saved_allergen_matches'->>'count')::integer,3,'enabled traces include source and legacy across canonical aliases');
SELECT ok(EXISTS(SELECT 1 FROM jsonb_array_elements(public.api_home_read_model()->'saved_allergen_matches'->'products') p,jsonb_array_elements(p->'matches') a WHERE a->>'allergen'='sesame' AND a->>'kind'='traces'),'source sesame-seeds alias remains a may-contain warning');
UPDATE public.user_preferences SET avoid_allergens=ARRAY['crustaceans'] WHERE user_id='ffffffff-1111-4111-8111-111111111111';
SELECT is((public.api_home_read_model()->'saved_allergen_matches'->>'count')::integer,0,'zero positive matches is a count, not an absence certification');
UPDATE public.user_preferences SET avoid_allergens=ARRAY['none'] WHERE user_id='ffffffff-1111-4111-8111-111111111111';
SELECT is(public.api_home_read_model()->'saved_allergen_matches'->>'state','not_configured','legacy none pseudo-tag does not become an allergen preference');
SELECT is(public.api_home_read_model()->'saved_allergen_matches'->'count','null'::jsonb,'no configuration is not a completed zero');

-- Entirely absent preference record cannot produce an implicitly safe warning state.
DELETE FROM public.user_preferences WHERE user_id='ffffffff-1111-4111-8111-111111111111';
SELECT is(public.api_home_read_model()->'saved_allergen_matches'->>'state','preferences_unavailable','missing preferences remain unavailable, not no warnings');
SELECT is(public.api_home_read_model()->'saved_allergen_matches'->'count','null'::jsonb,'unavailable preference count is withheld');
SELECT is((public.api_home_read_model()->'stats'->>'favorites_count')::integer,10,'neutral saved data remains available without preferences');

-- Owner isolation: the other account sees only its own selected favorite.
INSERT INTO public.user_product_list_items(list_id,product_id)
SELECT l.id,p.product_id FROM public.user_product_lists l CROSS JOIN home_products p
WHERE l.user_id='ffffffff-2222-4222-8222-222222222222' AND l.list_type='favorites' AND p.n=1;
SELECT set_config('request.jwt.claims','{"sub":"ffffffff-2222-4222-8222-222222222222","role":"authenticated"}',true);
SELECT is(public.api_home_read_model()->>'country','DE','market context belongs to the authenticated owner');
SELECT is((public.api_home_read_model()->'stats'->>'favorites_count')::integer,1,'other owner cannot enumerate favorite membership');
SELECT is((public.api_home_read_model()->'stats'->>'total_viewed')::integer,0,'other owner cannot enumerate viewing history');
SELECT is((public.api_home_read_model()->'saved_allergen_matches'->>'count')::integer,1,'other owner uses their own avoided allergens');

-- Corrupt reference fixture is transaction-local; no existing row is removed.
SET LOCAL session_replication_role='replica';
INSERT INTO public.user_product_views(user_id,product_id,viewed_at) VALUES('ffffffff-2222-4222-8222-222222222222',9000001,now());
INSERT INTO public.user_product_list_items(list_id,product_id,position)
SELECT id,9000001,-1 FROM public.user_product_lists WHERE user_id='ffffffff-2222-4222-8222-222222222222' AND list_type='favorites';
SET LOCAL session_replication_role='origin';
SELECT is(public.api_home_read_model()->'recently_viewed'->0->'product','null'::jsonb,'missing current product retains the viewed reference');
SELECT is(public.api_home_read_model()->'favorites_preview'->0->'product','null'::jsonb,'missing current product retains the favorite reference');
SELECT is((public.api_home_read_model()->'stats'->>'favorites_count')::integer,2,'missing product is not silently removed from saved count');
SELECT * FROM finish();
ROLLBACK;
