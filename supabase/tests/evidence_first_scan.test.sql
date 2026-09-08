-- Synthetic, transaction-only scan lifecycle. Never run on production.
BEGIN;
SELECT no_plan();
SELECT is(public.api_record_scan_v2('5901234123457','PL')->>'error','Authentication required','v2 scanning requires an authenticated session');
SELECT ok(NOT has_function_privilege('anon','public.api_record_scan_v2(text,text)','EXECUTE'),'anonymous cannot execute scan v2');
SELECT ok(NOT has_function_privilege('authenticated','evidence_private.record_scan_transaction(text,text)','EXECUTE'),'clients cannot call the legacy transaction directly');
INSERT INTO auth.users(id,email) VALUES('eeeeeeee-5555-4555-8555-555555555555','evidence-scan@test.tryvit.local');
SELECT set_config('request.jwt.claims','{"sub":"eeeeeeee-5555-4555-8555-555555555555","role":"authenticated"}',true);
INSERT INTO public.products(country,brand,product_name,category,ean) VALUES
 ('PL','Scan v2 fixture','Scan v2 Polish package','Dairy','9910000000703'),
 ('DE','Scan v2 fixture','Scan v2 German package','Dairy','9910000000703'),
 ('DE','Scan v2 fixture','Scan v2 cross-market package','Dairy','9910000000710');
CREATE TEMP TABLE scan_v2_fixture AS SELECT product_id,product_name,country FROM public.products WHERE brand='Scan v2 fixture';
INSERT INTO public.nutrition_facts(product_id,salt_g) SELECT product_id,0 FROM scan_v2_fixture;
SELECT is(public.api_record_scan('9910000000703','PL')->>'error','refresh_required','obsolete clients get an explicit refresh error');
SELECT is((SELECT count(*) FROM public.scan_history WHERE user_id=auth.uid()),0::bigint,'retired call does not write history');
SELECT is(public.api_record_scan_v2('aaaaaaaaaaaaa','PL')->>'error','EAN must be 8 or 13 digits','alphabetic strings cannot masquerade as barcodes');
SELECT is(public.api_record_scan_v2('9910000000703','US')->>'error','Unsupported scan country','unsupported market rejected before history mutation');
SELECT is((SELECT count(*) FROM public.scan_history WHERE user_id=auth.uid()),0::bigint,'invalid requests do not mutate scan history');
CREATE TEMP TABLE scan_v2_result AS SELECT public.api_record_scan_v2('9910000000703','PL') AS body;
SELECT is((SELECT body->>'api_version' FROM scan_v2_result),'2','scan has a versioned evidence contract');
SELECT is((SELECT body->'product'->>'product_name' FROM scan_v2_result),'Scan v2 Polish package','requested market selects the actual matching package');
SELECT is((SELECT body->'product'->'nutrition'->'salt_g'->>'value' FROM scan_v2_result),'0','explicit zero survives scanning');
SELECT is((SELECT body->'product'->'nutrition'->'salt_g'->>'state' FROM scan_v2_result),'unverified','a stored zero is not fabricated source verification');
SELECT is((SELECT body->'product'->'score'->>'status' FROM scan_v2_result),'retired','scan does not restore a universal score');
SELECT ok(NOT (SELECT body ? 'unhealthiness_score' OR body ? 'nutri_score' FROM scan_v2_result),'old score fields do not escape the private transaction');
SELECT is((SELECT count(*) FROM public.scan_history WHERE user_id=auth.uid()),1::bigint,'one valid scan writes one history record');
SELECT is(public.api_record_scan_v2('9910000000703','DE')->'product'->>'country','DE','duplicate EAN respects explicit market');
SELECT is(public.api_record_scan_v2('9910000000710','PL')->'product'->>'country','DE','cross-market fallback retains the actual product market');
SELECT is(public.api_record_scan_v2('9910000000710','PL')->>'scan_country','PL','cross-market disclosure retains requested market');
SELECT is(public.api_record_scan_v2('9910000000727','PL')->>'found','false','real lookup miss remains distinct from service failure');
SELECT is((SELECT count(*) FROM public.scan_history WHERE user_id=auth.uid()),5::bigint,'found and not-found requests retain truthful activity history');
SELECT is(public.api_get_scan_history()->>'error','refresh_required','old history endpoint cannot republish numeric grades');
SELECT is(public.api_get_scan_history_v2()->>'total','5','new history preserves owner counts');
SELECT is(jsonb_array_length(public.api_get_scan_history_v2(1,2)->'scans'),2,'history pagination is bounded');
SELECT ok(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.api_get_scan_history_v2()->'scans') s
  WHERE s ? 'unhealthiness_score' OR s ? 'nutri_score'),'all history rows omit legacy grades');
SELECT is(public.api_get_scan_history_v2(0)->>'error','Invalid scan history request','invalid paging fails closed');
SELECT is(public.api_get_scan_history_v2(1,20,'unexpected')->>'error','Invalid scan history request','unsupported history filter rejected');
SELECT isnt(public.api_get_scan_history_v2(1,1)->'scans'->0->>'scan_id',
  public.api_get_scan_history_v2(2,1)->'scans'->0->>'scan_id','equal-timestamp pages use deterministic unique ordering');
SELECT set_config('request.jwt.claims','{"sub":"eeeeeeee-5555-4555-8555-999999999999","role":"authenticated"}',true);
SELECT is(public.api_get_scan_history_v2()->>'total','0','another identity cannot read the first user history');
SELECT set_config('request.jwt.claims','{"sub":"eeeeeeee-5555-4555-8555-555555555555","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT throws_ok('SELECT evidence_private.record_scan_transaction(''9910000000703'',''PL'')','42501',
  'permission denied for function record_scan_transaction','actual client execution cannot bypass v2 payload rules');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
