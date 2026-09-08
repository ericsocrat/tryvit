-- Isolated, transaction-only membership fixtures; never production data.
BEGIN;
SELECT no_plan();
SELECT ok(NOT has_function_privilege('anon','public.api_saved_list_read_model(uuid,integer,integer,text)','EXECUTE'),'anonymous cannot read saved membership');
SELECT is(public.api_watched_products_read_model()->>'error','Authentication required','watchlist requires an authenticated owner');
INSERT INTO auth.users(id,email) VALUES
('dddddddd-1111-4111-8111-111111111111','collection-owner@test.tryvit.local'),
('dddddddd-2222-4222-8222-222222222222','collection-other@test.tryvit.local');
SELECT set_config('request.jwt.claims','{"sub":"dddddddd-1111-4111-8111-111111111111","role":"authenticated"}',true);
INSERT INTO public.products(country,brand,product_name,category,ean) VALUES
('PL','Collection fixture','Collection active','Dairy','9910000000775'),
('PL','Collection fixture','Collection archived','Dairy','9910000000768');
CREATE TEMP TABLE collection_products AS SELECT product_id,product_name FROM public.products WHERE brand='Collection fixture';
UPDATE public.products SET is_deprecated=true WHERE product_name='Collection archived' AND brand='Collection fixture';
INSERT INTO public.user_product_lists(id,user_id,name,list_type,description)
VALUES('dddddddd-3333-4333-8333-333333333333','dddddddd-1111-4111-8111-111111111111','Fixture notes','custom','Preserve description');
INSERT INTO public.user_product_list_items(list_id,product_id,position,notes,added_at)
SELECT 'dddddddd-3333-4333-8333-333333333333',product_id,
  CASE WHEN product_name='Collection archived' THEN 10 ELSE 20 END,
  CASE WHEN product_name='Collection archived' THEN E'Keep this\nsecond line' ELSE 'Active note' END,
  '2025-01-01T12:00:00Z'::timestamptz FROM collection_products;
CREATE TEMP TABLE collection_response AS SELECT public.api_saved_list_read_model('dddddddd-3333-4333-8333-333333333333',1,0,'en') AS body;
SELECT is((SELECT body->>'api_version' FROM collection_response),'2','collection read is versioned');
SELECT is((SELECT (body->>'total_count')::integer FROM collection_response),2,'total counts archived and active saved entries');
SELECT is((SELECT jsonb_array_length(body->'items') FROM collection_response),1,'membership is paged before projection');
SELECT is((SELECT body->'items'->0->'product'->>'product_name' FROM collection_response),'Collection archived','saved position controls order, not catalog activity');
SELECT is((SELECT (body->'items'->0->'product'->>'is_deprecated')::boolean FROM collection_response),true,'archive state remains visible');
SELECT is((SELECT body->'items'->0->>'notes' FROM collection_response),E'Keep this\nsecond line','notes and line breaks are retained');
SELECT is((SELECT (body->'items'->0->>'added_at')::timestamptz FROM collection_response),'2025-01-01T12:00:00Z'::timestamptz,'membership timestamp is retained');
SELECT is((SELECT body->'items'->0->'product'->'score'->'value' FROM collection_response),'null'::jsonb,'no saved universal score leaks');
SELECT is(public.api_saved_list_read_model('dddddddd-3333-4333-8333-333333333333',1,1,'en')->'items'->0->'product'->>'product_name','Collection active','next page retains explicit saved order');
SELECT is(public.api_get_list_items('dddddddd-3333-4333-8333-333333333333')->>'error','refresh_required','legacy list client must refresh before reading evidence');
SELECT is(public.api_get_list_items('dddddddd-3333-4333-8333-333333333333')->>'status','refresh_required','retired list endpoint has no success disposition');
SELECT ok(NOT(public.api_get_list_items('dddddddd-3333-4333-8333-333333333333') ? 'items'),'legacy export receives no nullable score-bearing rows');
SELECT is(public.api_saved_list_read_model('dddddddd-3333-4333-8333-333333333333',101)->>'error','Invalid collection page','unbounded collection projection is rejected');
SELECT is(public.api_saved_list_read_model('dddddddd-9999-4999-8999-999999999999')->>'error','List not found','missing list is not misreported as empty');
SELECT set_config('request.jwt.claims','{"sub":"dddddddd-2222-4222-8222-222222222222","role":"authenticated"}',true);
SELECT is(public.api_saved_list_read_model('dddddddd-3333-4333-8333-333333333333')->>'error','List not found','another user cannot enumerate private notes');
SELECT set_config('request.jwt.claims','{"sub":"dddddddd-1111-4111-8111-111111111111","role":"authenticated"}',true);
INSERT INTO public.user_watched_products(user_id,product_id,created_at)
SELECT 'dddddddd-1111-4111-8111-111111111111',product_id,'2025-02-01T12:00:00Z'::timestamptz FROM collection_products;
SELECT is((public.api_watched_products_read_model()->>'total')::integer,2,'watched membership retains archived products');
SELECT is(jsonb_array_length(public.api_watched_products_read_model()->'items'),2,'watchlist returns both saved IDs');
SELECT ok(NOT(public.api_watched_products_read_model()->'items'->0 ? 'current_score'),'watchlist has no legacy trend score');
SELECT is((public.api_watched_products_read_model()->'items'->0->>'watched_since')::timestamptz,'2025-02-01T12:00:00Z'::timestamptz,'watch start time is preserved');
SELECT set_config('request.jwt.claims','{"sub":"dddddddd-2222-4222-8222-222222222222","role":"authenticated"}',true);
SELECT is((public.api_watched_products_read_model()->>'total')::integer,0,'watched records remain owner-scoped');

-- Explicit corruption fixture proves a missing current record does not silently
-- remove retained membership. FK bypass is transaction-local and restored before reads.
SELECT set_config('request.jwt.claims','{"sub":"dddddddd-1111-4111-8111-111111111111","role":"authenticated"}',true);
SELECT ok(NOT EXISTS(SELECT 1 FROM public.products WHERE product_id=990999999),'orphan fixture ID is not an existing product');
SET LOCAL session_replication_role=replica;
INSERT INTO public.user_product_list_items(list_id,product_id,position,notes) VALUES('dddddddd-3333-4333-8333-333333333333',990999999,30,'Orphan fixture note');
SET LOCAL session_replication_role=origin;
SELECT is((public.api_saved_list_read_model('dddddddd-3333-4333-8333-333333333333')->>'total_count')::integer,3,'missing record remains part of membership count');
SELECT is(public.api_saved_list_read_model('dddddddd-3333-4333-8333-333333333333')->'items'->2->'product','null'::jsonb,'missing current record is explicit, not fabricated');
SELECT is(public.api_saved_list_read_model('dddddddd-3333-4333-8333-333333333333')->'items'->2->>'notes','Orphan fixture note','missing current record does not lose saved notes');
SELECT * FROM finish();
ROLLBACK;
