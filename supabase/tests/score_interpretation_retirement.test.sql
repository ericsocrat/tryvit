-- Transaction-only synthetic fixtures; no production data or historical rewrites.
BEGIN;
SELECT no_plan();
-- Explicit transaction-only definitions also work against a schema/catalog
-- restoration, which deliberately does not export activity or user rows.
INSERT INTO public.achievement_def(slug,category,title_key,desc_key,icon,threshold) VALUES
('first_low_score','health','synthetic.retired.title','synthetic.retired.description','fixture',1),
('first_scan','exploration','synthetic.scan.title','synthetic.scan.description','fixture',1),
('allergen_filter','health','synthetic.allergen.title','synthetic.allergen.description','fixture',1)
ON CONFLICT (slug) DO NOTHING;
SELECT is(public.api_get_achievements()->>'error','Authentication required','activity requires authentication');
SELECT ok(NOT has_function_privilege('authenticated','public.api_get_pending_notifications(integer)','EXECUTE'),'clients cannot retrieve queued push payloads');
SELECT ok(NOT has_function_privilege('anon','public.get_recipe_detail(text)','EXECUTE'),'recipe details remain private beta');
SELECT ok(NOT has_function_privilege('authenticated','evidence_private.legacy_recipe_score_v1(text)','EXECUTE'),'historical recipe formula is service-owned only');
SELECT ok(NOT has_function_privilege('authenticated','evidence_private.legacy_recipe_nutrition_v1(text)','EXECUTE'),'historical nutrition estimate is service-owned only');
SELECT is(public.api_get_recipe_score('anything')->>'status','retired','recipe score cannot return a favorable missing-input fallback');
SELECT ok(NOT (public.api_get_recipe_score('anything') ? 'aggregate_score'),'retired recipe endpoint emits no aggregate');
SELECT is(public.api_get_recipe_nutrition('anything')->>'status','retired','incompatible recipe totals are withheld');
SELECT is(public.api_get_ingredient_profile(1)->>'status','refresh_required','unsupported ingredient health interpretation requires client refresh');

INSERT INTO auth.users(id,email) VALUES ('eeeeeeee-1111-4111-8111-111111111111','retirement-fixture@test.tryvit.local');
SELECT set_config('request.jwt.claims','{"sub":"eeeeeeee-1111-4111-8111-111111111111","role":"authenticated"}',true);
INSERT INTO public.user_achievement(user_id,achievement_id,progress,unlocked_at)
SELECT 'eeeeeeee-1111-4111-8111-111111111111',id,1,'2025-01-01T00:00:00Z'::timestamptz
FROM public.achievement_def WHERE slug='first_low_score';
CREATE TEMP TABLE original_retired_activity AS SELECT to_jsonb(a) body FROM public.user_achievement a WHERE user_id='eeeeeeee-1111-4111-8111-111111111111';
SELECT is(public.increment_achievement_progress('first_low_score')->>'status','retired','retired score milestone cannot award new progress');
SELECT is(public.increment_achievement_progress('low_score_10')->>'status','retired','second score milestone cannot award progress');
SELECT is(public.increment_achievement_progress('all_health')->>'status','retired','score-dependent meta milestone cannot award progress');
SELECT is((SELECT to_jsonb(a) FROM public.user_achievement a WHERE user_id='eeeeeeee-1111-4111-8111-111111111111'),(SELECT body FROM original_retired_activity),'old activity row remains byte-for-byte unchanged');
SELECT is(jsonb_array_length(public.api_get_achievements()->'retired_achievements'),1,'existing retired activity remains visible as history');
SELECT is(public.api_get_achievements()->'retired_achievements'->0->>'status','retired','archive is explicitly labelled retired');
SELECT ok(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.api_get_achievements()->'achievements') a WHERE a->>'slug' IN ('first_low_score','low_score_10','all_health')),'current activity excludes unsupported awards');
SELECT ok(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.api_get_achievements()->'achievements') a WHERE a->>'category'='health'),'ordinary interactions are not health outcomes');
SELECT is((public.increment_achievement_progress('first_scan')->>'progress')::integer,1,'ordinary scan activity remains functional');
SELECT is((public.increment_achievement_progress('first_scan')->>'newly_unlocked')::boolean,false,'repeated neutral activity does not repeat unlock');
SELECT is((SELECT a->>'desc_key' FROM jsonb_array_elements(public.api_get_achievements()->'achievements') a WHERE a->>'slug'='allergen_filter'),'evidenceActivity.allergenFilterDescription','allergen interaction does not certify safety');

INSERT INTO public.products(country,brand,product_name,category,unhealthiness_score) VALUES
('PL','Fixture','Retirement Zulu','Dairy',1),('PL','Fixture','Retirement Alpha','Dairy',99);
CREATE TEMP TABLE retirement_products AS SELECT product_id,product_name FROM public.products WHERE product_name IN ('Retirement Zulu','Retirement Alpha');
INSERT INTO public.user_watched_products(user_id,product_id) SELECT 'eeeeeeee-1111-4111-8111-111111111111',product_id FROM retirement_products;
INSERT INTO public.notification_queue(user_id,product_id,product_name,old_score,new_score,delta,direction)
SELECT 'eeeeeeee-1111-4111-8111-111111111111',product_id,product_name,1,99,98,'worsened' FROM retirement_products;
CREATE TEMP TABLE original_retired_queue AS SELECT jsonb_agg(to_jsonb(q) ORDER BY id) body FROM public.notification_queue q WHERE user_id='eeeeeeee-1111-4111-8111-111111111111';
INSERT INTO public.product_score_history(product_id,recorded_at,unhealthiness_score,score_delta,trigger_source)
SELECT product_id,'2025-01-01',99,98,'pipeline' FROM retirement_products;
SELECT is((SELECT jsonb_agg(to_jsonb(q) ORDER BY id) FROM public.notification_queue q WHERE user_id='eeeeeeee-1111-4111-8111-111111111111'),(SELECT body FROM original_retired_queue),'new score history neither queues alerts nor changes old queued rows');
SELECT is((SELECT count(*)::integer FROM public.product_score_history WHERE product_id IN (SELECT product_id FROM retirement_products)),2,'ordinary score audit history remains stored');
SELECT is(jsonb_array_length(public.api_get_pending_notifications()->'notifications'),0,'even retained old queued alerts cannot dispatch');
SELECT is((public.api_get_pending_notifications()->>'dispatch_paused')::boolean,true,'dispatcher states its paused boundary');
SELECT is((SELECT count(*)::integer FROM public.user_watched_products WHERE user_id='eeeeeeee-1111-4111-8111-111111111111'),2,'watched membership is preserved');

INSERT INTO public.recipe(id,slug,title_key,description_key,category,prep_time_min,cook_time_min,servings,is_published,tags)
VALUES('eeeeeeee-2222-4222-8222-222222222222','retirement-fixture','fixture.title','fixture.description','breakfast',10,0,1,true,ARRAY['high-fiber','vegan']);
INSERT INTO public.recipe_ingredient(id,recipe_id,name_key,sort_order,optional)
VALUES('eeeeeeee-3333-4333-8333-333333333333','eeeeeeee-2222-4222-8222-222222222222','fixture.ingredient',1,true);
INSERT INTO public.recipe_step(recipe_id,step_number,content_key)
VALUES('eeeeeeee-2222-4222-8222-222222222222',1,'fixture.step');
INSERT INTO public.recipe_ingredient_product(recipe_ingredient_id,product_id,is_primary,match_confidence)
SELECT 'eeeeeeee-3333-4333-8333-333333333333',product_id,product_name='Retirement Zulu',0.99 FROM retirement_products;
SELECT is(public.get_recipe_detail('retirement-fixture')->'tags','[]'::jsonb,'reader withholds unverified dietary tags');
SELECT is((SELECT tags FROM public.recipe WHERE slug='retirement-fixture'),ARRAY['high-fiber','vegan'],'authored tag history is not deleted');
SELECT is(public.get_recipe_detail('retirement-fixture')->'ingredients'->0->>'name_key','fixture.ingredient','useful ingredient instructions remain');
SELECT is((public.get_recipe_detail('retirement-fixture')->'ingredients'->0->>'optional')::boolean,true,'optional ingredient state remains');
SELECT is(public.get_recipe_detail('retirement-fixture')->'steps'->0->>'content_key','fixture.step','ordered cooking steps remain');
SELECT is(public.get_recipe_detail('retirement-fixture')->'ingredients'->0->'linked_products'->0->>'product_name','Retirement Alpha','links are alphabetical, not healthiest/primary-ranked');
SELECT is(public.get_recipe_detail('retirement-fixture')->'ingredients'->0->'linked_products'->0->'unhealthiness_score','null'::jsonb,'linked product grade is withheld');
SELECT is(public.get_recipe_detail('retirement-fixture')->'ingredients'->0->'linked_products'->0->'match_confidence','null'::jsonb,'unvalidated matching confidence is withheld');
SELECT is((SELECT count(*)::integer FROM public.find_products_for_recipe_ingredient('eeeeeeee-3333-4333-8333-333333333333')),2,'stored catalogue associations survive');
SELECT ok(NOT EXISTS(SELECT 1 FROM public.find_products_for_recipe_ingredient('eeeeeeee-3333-4333-8333-333333333333') WHERE unhealthiness_score IS NOT NULL OR is_primary),'ingredient lookup cannot rank with retired scores');
SELECT throws_ok($$SELECT * FROM public.browse_recipes(p_tag=>'vegan')$$,'22023','Recipe tag and total-time filters are retired','old dietary filter is explicitly rejected');
SELECT throws_ok($$SELECT * FROM public.browse_recipes(p_max_time=>10)$$,'22023','Recipe tag and total-time filters are retired','old total-time filter cannot exclude mandatory waiting time silently');
SELECT is(public.api_get_recipe_detail('retirement-fixture')->'recipe'->>'slug','retirement-fixture','compatible recipe detail retains identity');
SELECT is(public.get_recipe_detail('missing-retirement-fixture'),NULL::jsonb,'not found is distinct from recipe load failure');
SELECT * FROM finish();
ROLLBACK;
