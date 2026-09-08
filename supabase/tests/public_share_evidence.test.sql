-- Only synthetic local identities/rows; every fixture is rolled back.
BEGIN;
SELECT no_plan();
CREATE TEMP TABLE public_share_fixture(key text PRIMARY KEY,value text);
INSERT INTO public_share_fixture VALUES ('owner_a',gen_random_uuid()::text),('owner_b',gen_random_uuid()::text);
INSERT INTO auth.users(id,email) SELECT value::uuid,key||'@public-share.test' FROM public_share_fixture;
INSERT INTO public.products(country,ean,brand,product_name,category,is_deprecated)
VALUES('PL','9900000880001','Public share fixture','Shared fixture first','Dairy',false),
      ('PL','9900000880002','Public share fixture','Shared fixture second','Dairy',false),
      ('PL','9900000880003','Public share fixture','Shared fixture deprecated','Dairy',true);
INSERT INTO public_share_fixture SELECT 'product_'||row_number() OVER(ORDER BY ean),product_id::text
FROM public.products WHERE brand='Public share fixture';
WITH made AS (
  INSERT INTO public.user_product_lists(user_id,name,description,share_enabled,share_token,list_type)
  VALUES((SELECT value::uuid FROM public_share_fixture WHERE key='owner_a'),'Shared fixture list','PRIVATE DESCRIPTION',true,'aaaabbbbccccddddeeeeffff','custom'),
        ((SELECT value::uuid FROM public_share_fixture WHERE key='owner_b'),'Other owner list','OTHER PRIVATE DESCRIPTION',true,'111122223333444455556666','custom') RETURNING id,name
) INSERT INTO public_share_fixture SELECT CASE WHEN name='Shared fixture list' THEN 'list_a' ELSE 'list_b' END,id::text FROM made;
INSERT INTO public.user_product_list_items(list_id,product_id,position,notes)
SELECT (SELECT value::uuid FROM public_share_fixture WHERE key='list_a'),value::bigint,
  CASE key WHEN 'product_1' THEN 2 WHEN 'product_2' THEN 1 ELSE 3 END,'PRIVATE ITEM NOTE'
FROM public_share_fixture WHERE key LIKE 'product_%';
WITH made AS (
  INSERT INTO public.user_comparisons(user_id,title,product_ids,share_token)
  SELECT value::uuid,'Shared fixture comparison',ARRAY[
    (SELECT value::bigint FROM public_share_fixture WHERE key='product_2'),
    (SELECT value::bigint FROM public_share_fixture WHERE key='product_1'),
    (SELECT value::bigint FROM public_share_fixture WHERE key='product_3')],
    'abcdefabcdefabcdefabcdef' FROM public_share_fixture WHERE key='owner_a' RETURNING id
) INSERT INTO public_share_fixture SELECT 'comparison',id::text FROM made;
DO $$ BEGIN
  PERFORM set_config('test.share.owner_a',(SELECT value FROM public_share_fixture WHERE key='owner_a'),true);
  PERFORM set_config('test.share.owner_b',(SELECT value FROM public_share_fixture WHERE key='owner_b'),true);
  PERFORM set_config('test.share.list_a',(SELECT value FROM public_share_fixture WHERE key='list_a'),true);
  PERFORM set_config('test.share.list_b',(SELECT value FROM public_share_fixture WHERE key='list_b'),true);
END $$;

SELECT ok(NOT has_table_privilege('anon','public.user_comparisons','SELECT'),'anon cannot enumerate comparisons');
SELECT ok(NOT has_table_privilege('anon','public.user_product_lists','SELECT'),'anon cannot enumerate list tokens/owner IDs');
SELECT ok(NOT has_table_privilege('anon','public.user_product_list_items','SELECT'),'anon cannot enumerate private notes');
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('user_comparisons','user_product_lists','user_product_list_items')
  AND policyname LIKE 'Public read%'),0::bigint,'unsafe PUBLIC policies removed for both anon and authenticated');
SELECT ok(NOT has_function_privilege('anon','evidence_private.product_one(bigint,text)','EXECUTE'),'token reader does not grant anonymous direct product helper access');

SET LOCAL ROLE anon;
SELECT throws_ok('SELECT * FROM public.user_product_lists','42501',NULL,'direct anonymous list read denied');
SELECT throws_ok('SELECT * FROM public.user_product_list_items','42501',NULL,'direct anonymous notes read denied');
SELECT throws_ok('SELECT * FROM public.user_comparisons','42501',NULL,'direct anonymous comparison read denied');
SELECT is(public.api_get_shared_list_v2('aaaabbbbccccddddeeeeffff')->>'title','Shared fixture list','token permits only the selected list');
SELECT is(public.api_get_shared_list_v2('aaaabbbbccccddddeeeeffff')->>'total_count','2','public count matches available records');
SELECT is(public.api_get_shared_list_v2('aaaabbbbccccddddeeeeffff')->>'unavailable_count','1','deprecated product remains an explicit unavailable count');
SELECT is(public.api_get_shared_list_v2('aaaabbbbccccddddeeeeffff')->'products'->0->>'product_name','Shared fixture second','stable requested item order preserved');
SELECT is(jsonb_array_length(public.api_get_shared_list_v2('aaaabbbbccccddddeeeeffff','en',1,1)->'products'),1,'bounded pagination works');
SELECT ok(NOT (public.api_get_shared_list_v2('aaaabbbbccccddddeeeeffff')::text LIKE '%PRIVATE%'),'descriptions and item notes never returned');
SELECT ok(NOT (public.api_get_shared_list_v2('aaaabbbbccccddddeeeeffff')::text LIKE '%'||current_setting('test.share.owner_a')||'%'),'owner ID never returned');
SELECT ok(NOT (public.api_get_shared_list_v2('aaaabbbbccccddddeeeeffff')::text LIKE '%'||current_setting('test.share.list_a')||'%'),'private list ID never returned');
SELECT is(public.api_get_shared_list_v2('does-not-exist-000000000')->>'error','invalid_share','unknown token fails closed');
SELECT is(public.api_get_shared_list_v2('x')->>'error','invalid_share','malformed token rejected');
SELECT is(public.api_get_shared_list_v2('aaaabbbbccccddddeeeeffff','en',51,0)->>'error','invalid_request','unbounded list reads rejected');
SELECT is(public.api_get_shared_comparison_v2('abcdefabcdefabcdefabcdef')->>'product_count','2','comparison contains only available products');
SELECT is(public.api_get_shared_comparison_v2('abcdefabcdefabcdefabcdef')->>'unavailable_count','1','comparison preserves missing evidence disposition');
SELECT is(public.api_get_shared_comparison_v2('abcdefabcdefabcdefabcdef')->'products'->0->>'product_name','Shared fixture second','comparison selection order preserved');
SELECT ok(NOT (public.api_get_shared_comparison_v2('abcdefabcdefabcdefabcdef') ? 'comparison_id'),'private comparison ID omitted');
SELECT ok(NOT (public.api_get_shared_comparison_v2('abcdefabcdefabcdefabcdef') ? 'created_at'),'private activity timestamp omitted');
SELECT is(public.api_get_shared_comparison_v2('abcdefabcdefabcdefabcdef')->'products'->0->'score'->>'status','retired','no aggregate score fallback');
SELECT is(public.api_get_shared_list('aaaabbbbccccddddeeeeffff')->>'error','share_client_refresh_required','legacy list client gets explicit refresh requirement');
SELECT is(public.api_get_shared_comparison('abcdefabcdefabcdefabcdef')->>'error','share_client_refresh_required','legacy comparison client gets explicit refresh requirement');

RESET ROLE;
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub',current_setting('test.share.owner_a'),true); END $$;
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.user_product_lists WHERE id=current_setting('test.share.list_a')::uuid),1::bigint,'owner still reads own collection');
SELECT is((SELECT count(*) FROM public.user_product_lists WHERE id=current_setting('test.share.list_b')::uuid),0::bigint,'authenticated nonowner cannot enumerate another shared list');
SELECT is((SELECT count(*) FROM public.user_product_lists WHERE user_id=current_setting('test.share.owner_b')::uuid),0::bigint,'other owner data remains isolated');
SELECT is(public.api_get_shared_list_v2('111122223333444455556666')->>'title','Other owner list','authenticated visitor with token can read approved public content');

RESET ROLE;
UPDATE public.user_product_lists SET share_enabled=false WHERE id=current_setting('test.share.list_a')::uuid;
SET LOCAL ROLE anon;
SELECT is(public.api_get_shared_list_v2('aaaabbbbccccddddeeeeffff')->>'error','invalid_share','sharing disable revokes the next read');
RESET ROLE;
UPDATE public.user_product_lists SET share_enabled=true,share_token='replacement-token-00000000' WHERE id=current_setting('test.share.list_a')::uuid;
DELETE FROM public.user_comparisons WHERE share_token='abcdefabcdefabcdefabcdef';
SET LOCAL ROLE anon;
SELECT is(public.api_get_shared_list_v2('aaaabbbbccccddddeeeeffff')->>'error','invalid_share','rotation permanently revokes old token');
SELECT is(public.api_get_shared_list_v2('replacement-token-00000000')->>'title','Shared fixture list','replacement token remains usable');
SELECT is(public.api_get_shared_comparison_v2('abcdefabcdefabcdefabcdef')->>'error','invalid_share','deletion revokes comparison token');
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.share.owner_a'),'role','authenticated')::text,true);
SELECT set_config('request.jwt.claim.sub',current_setting('test.share.owner_a'),true);
CREATE TEMP TABLE private_save_result AS
 SELECT public.api_save_comparison(ARRAY[
   (SELECT value::bigint FROM public_share_fixture WHERE key='product_1'),
   (SELECT value::bigint FROM public_share_fixture WHERE key='product_2')],'Private fixture') AS body;
SELECT ok((SELECT body ? 'comparison_id' AND body->'share_token'='null'::jsonb FROM private_save_result),
  'saving a comparison does not create a public capability');
SELECT ok(EXISTS(SELECT 1 FROM public.user_comparisons c JOIN private_save_result r
  ON c.id=(r.body->>'comparison_id')::uuid WHERE c.user_id=auth.uid() AND c.share_token IS NULL),
  'saved comparison is owner-private in storage');
SELECT is(public.api_toggle_share(current_setting('test.share.list_a')::uuid,NULL)->>'error',
  'Sharing choice is required','an absent sharing choice is not interpreted as consent');
SELECT is(public.api_revoke_share(current_setting('test.share.list_a')::uuid)->>'success','true',
  'owner can revoke an existing link without generating a replacement secret');
SELECT ok(EXISTS(SELECT 1 FROM public.user_product_lists WHERE id=current_setting('test.share.list_a')::uuid
  AND NOT share_enabled AND share_token IS NULL),'revocation clears the stored capability');
CREATE TEMP TABLE enabled_share AS SELECT public.api_toggle_share(current_setting('test.share.list_a')::uuid,true) AS body;
SELECT ok((SELECT body->>'share_enabled'='true' AND body->>'share_token' ~ '^[A-Za-z0-9_-]{24}$' FROM enabled_share),
  'explicit sharing generates a URL-safe random capability');
SELECT is(public.api_get_shared_list_v2('replacement-token-00000000')->>'error','invalid_share',
  'an explicitly revoked link cannot revive after re-enabling');
SELECT is((SELECT public.api_get_shared_list_v2(body->>'share_token')->>'title' FROM enabled_share),
  'Shared fixture list','newly generated capability authorizes the intended list');
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.share.owner_b'),'role','authenticated')::text,true);
SELECT set_config('request.jwt.claim.sub',current_setting('test.share.owner_b'),true);
SELECT is(public.api_revoke_share(current_setting('test.share.list_a')::uuid)->>'error','List not found',
  'another user cannot revoke the owner capability');
SELECT * FROM finish();
ROLLBACK;
