-- Read-only assertions on the corrected current-integrity registry.
BEGIN;
SELECT plan(5);
SELECT is((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='compute_score'),1::bigint,'exactly one reviewed compute_score function exists');
SELECT is((SELECT encode(sha256(prosrc::bytea),'hex') FROM pg_proc WHERE oid='public.compute_score(bigint,text,text,text)'::regprocedure),'783566e4408b42edce0479c24169aa541bcdb25f4c466a8fa6d403a98b0a78e0','compute_score body remains the reviewed v3.3 source');
SELECT is((SELECT expected_hash FROM public.formula_source_hashes WHERE function_name='compute_score'),'783566e4408b42edce0479c24169aa541bcdb25f4c466a8fa6d403a98b0a78e0','current registry attests the reviewed v3.3 source');
SELECT ok(EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.formula_source_hashes'::regclass AND c.contype='u' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='function_name')]::smallint[]),'registry permits one current row per function name');
SELECT is((SELECT status FROM public.check_function_source_drift() WHERE function_name='compute_score'),'match','current source drift check matches');
SELECT * FROM finish();
ROLLBACK;
