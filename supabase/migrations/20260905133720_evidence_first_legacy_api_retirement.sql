-- Close historical consumer capabilities, not merely their UI imports.
-- Historical formula/data implementations remain operator-only and unchanged.
-- No catalog, user, score history, preference or membership row is rewritten.
BEGIN;

DO $retire$
DECLARE
  v_names text[]:=ARRAY[
    'api_product_detail','api_product_detail_by_ean',
    'api_get_product_profile','api_get_product_profile_by_ean',
    'api_search_products','api_search_autocomplete','api_search_did_you_mean',
    'api_get_filter_options','api_category_listing','api_category_overview',
    'api_get_products_for_compare','api_better_alternatives','api_better_alternatives_v2',
    'api_score_explanation','api_data_confidence','api_product_provenance',
    'api_get_score_history','api_score_history','api_get_recently_viewed',
    'api_get_watchlist','api_dashboard_insights','api_get_cross_country_links',
    'api_store_products','api_product_health_warnings'
  ];
  v_name text; v_callee text; v_private_oid oid; v_definition text; r record;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    SELECT p.oid,pg_get_function_identity_arguments(p.oid) AS identity_args,oidvectortypes(p.proargtypes) AS argument_types,
      pg_get_function_result(p.oid) AS result_type
    INTO STRICT r FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=v_name AND p.prokind='f';
    IF r.result_type <> 'jsonb' THEN RAISE EXCEPTION 'Unexpected return contract for %',v_name; END IF;
    v_private_oid:=to_regprocedure(format('evidence_private.%I(%s)',v_name,r.argument_types));
    IF v_private_oid IS NULL THEN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET SCHEMA evidence_private',v_name,r.identity_args);
      v_private_oid:=r.oid;
    END IF;
    -- Explicit pg_temp placement prevents temporary relations shadowing the
    -- historical unqualified table names. No client can CREATE in this schema.
    EXECUTE format('ALTER FUNCTION evidence_private.%I(%s) SET search_path=evidence_private,public,pg_temp',v_name,r.identity_args);
    v_definition:=pg_get_functiondef(v_private_oid);
    FOREACH v_callee IN ARRAY v_names LOOP
      v_definition:=replace(v_definition,'public.'||v_callee||'(','evidence_private.'||v_callee||'(');
    END LOOP;
    IF v_name='api_search_did_you_mean' THEN
      -- Historical operator code referenced a nonexistent pre-rename column.
      -- Correct only identity lookup; retain its unvalidated ranking unchanged.
      v_definition:=regexp_replace(v_definition,'p\.id([[:space:]]+AS[[:space:]]+product_id)','p.product_id\1','gi');
    END IF;
    EXECUTE v_definition;
    EXECUTE format('REVOKE ALL ON FUNCTION evidence_private.%I(%s) FROM PUBLIC,anon,authenticated',v_name,r.identity_args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION evidence_private.%I(%s) TO service_role',v_name,r.identity_args);
    EXECUTE format('COMMENT ON FUNCTION evidence_private.%I(%s) IS %L',v_name,r.identity_args,
      'Historical operator audit only. Retained implementation is not a validated health model or a current consumer contract.');
    -- Same argument/default signature gives old clients a deterministic error,
    -- never missing fields that could be coerced into zero, absence or safety.
    EXECUTE format($ddl$
      CREATE OR REPLACE FUNCTION public.%I(%s)
      RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $shim$
        SELECT jsonb_build_object(
          'api_version','2','policy_version','evidence-first-v1',
          'error','refresh_required','status','refresh_required',
          'message','Refresh TryVit to use source-backed product evidence.');
      $shim$;
    $ddl$,v_name,pg_get_function_arguments(v_private_oid));
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated',v_name,r.identity_args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated,service_role',v_name,r.identity_args);
  END LOOP;
END $retire$;

-- This already operator-only profile body calls api_score_explanation without
-- qualification; keep that dependency on its historical implementation.
ALTER FUNCTION public.get_product_profile_v1_legacy_internal(bigint,text)
  SET search_path=evidence_private,public,pg_temp;
REVOKE ALL ON FUNCTION public.get_product_profile_v1_legacy_internal(bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_profile_v1_legacy_internal(bigint,text) TO service_role;

-- Non-API helpers are implementation details, not alternative PostgREST routes.
-- Keep their exact formula/lookup behavior available to trusted operator code.
DO $helpers$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'find_better_alternatives','find_better_alternatives_v2',
      'find_similar_products','compute_data_confidence','compute_health_warnings')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated',r.proname,r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',r.proname,r.args);
  END LOOP;
END $helpers$;

-- Pure historical formulas are still RPC capabilities when left executable by
-- browser roles. Keep their exact bodies/types for service audits and existing
-- postgres-owned internal computation, without exposing current consumer grades.
REVOKE EXECUTE ON FUNCTION
 public.assign_confidence(numeric,text),
 public.compute_data_completeness(bigint),
 public.compute_unhealthiness_v32(numeric,numeric,numeric,numeric,numeric,numeric,text,text,numeric),
 public.compute_unhealthiness_v33(numeric,numeric,numeric,numeric,numeric,numeric,text,text,numeric,numeric,numeric),
 public.explain_score_v32(numeric,numeric,numeric,numeric,numeric,numeric,text,text,numeric),
 public.explain_score_v33(numeric,numeric,numeric,numeric,numeric,numeric,text,text,numeric,numeric,numeric),
 public.compute_nutri_score_label(numeric,numeric,numeric,numeric,numeric,numeric,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 public.assign_confidence(numeric,text),
 public.compute_data_completeness(bigint),
 public.compute_unhealthiness_v32(numeric,numeric,numeric,numeric,numeric,numeric,text,text,numeric),
 public.compute_unhealthiness_v33(numeric,numeric,numeric,numeric,numeric,numeric,text,text,numeric,numeric,numeric),
 public.explain_score_v32(numeric,numeric,numeric,numeric,numeric,numeric,text,text,numeric),
 public.explain_score_v33(numeric,numeric,numeric,numeric,numeric,numeric,text,text,numeric,numeric,numeric),
 public.compute_nutri_score_label(numeric,numeric,numeric,numeric,numeric,numeric,boolean)
 TO service_role;

-- Census: browser code does not SELECT these objects directly. Authenticated
-- user preferences, health-profile records, flags, storage and supported RPC
-- writes are intentionally unaffected. SECURITY DEFINER v2 readers/monitoring
-- retain their server-owned access. No row policies or historical rows change.
REVOKE SELECT ON public.v_master,public.mv_scoring_distribution,
  public.v_product_confidence,public.mv_ingredient_frequency,
  public.product_score_history,public.product_field_provenance,
  public.product_links,public.recipe_ingredient_product,
  public.score_distribution_snapshots,public.score_shadow_results,
  public.notification_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v_master,public.mv_scoring_distribution,
  public.v_product_confidence,public.mv_ingredient_frequency,
  public.product_score_history,public.product_field_provenance,
  public.product_links,public.recipe_ingredient_product,
  public.score_distribution_snapshots,public.score_shadow_results,
  public.notification_queue TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
