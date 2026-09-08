-- Migration: Correct the guarded current compute_score integrity registry hash.
-- Rollback: Restore only the captured registry row through a reviewed compare-and-set; never change function bodies or historical scores.
-- Correct current integrity metadata omitted by the v3.3 migration.
-- This does not change a scoring function, model configuration or stored score.
-- Previous body: 20260225000000_canonical_scoring_engine.sql
--   e7b71cb1ab333a4809e4bebe8c8f654e180b824868b08f2870a168e25e13ad7c
-- Current body: 20260315001910_scoring_v33_nutrient_density.sql
--   783566e4408b42edce0479c24169aa541bcdb25f4c466a8fa6d403a98b0a78e0
-- formula_source_hashes is the mutable current-function registry, not history.
-- The original attestation remains recorded above and in its original migration.
DO $registry$
DECLARE
  v_old constant text := 'e7b71cb1ab333a4809e4bebe8c8f654e180b824868b08f2870a168e25e13ad7c';
  v_current constant text := '783566e4408b42edce0479c24169aa541bcdb25f4c466a8fa6d403a98b0a78e0';
  v_actual text;
  v_registered text;
BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='compute_score') <> 1 THEN
    RAISE EXCEPTION 'compute_score registry correction requires one reviewed function';
  END IF;
  SELECT encode(sha256(prosrc::bytea),'hex') INTO v_actual
    FROM pg_proc WHERE oid='public.compute_score(bigint,text,text,text)'::regprocedure;
  IF v_actual IS DISTINCT FROM v_current THEN
    RAISE EXCEPTION 'compute_score body differs from reviewed v3.3 source';
  END IF;
  SELECT expected_hash INTO v_registered FROM public.formula_source_hashes
    WHERE function_name='compute_score' FOR UPDATE;
  IF NOT FOUND OR v_registered NOT IN (v_old,v_current) THEN
    RAISE EXCEPTION 'compute_score registry state differs from reviewed correction';
  END IF;
  IF v_registered=v_old THEN
    UPDATE public.formula_source_hashes SET expected_hash=v_current,updated_at=now()
      WHERE function_name='compute_score' AND expected_hash=v_old;
  END IF;
END;
$registry$;
