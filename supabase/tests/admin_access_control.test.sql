-- pgTAP: private-beta administration and operations access boundary.
-- Run via: supabase test db

BEGIN;
SELECT plan(20);

CREATE TEMP TABLE private_beta_admin_routines (
  signature text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO private_beta_admin_routines(signature) VALUES
  ('public.api_admin_batch_reject_user(uuid,text)'),
  ('public.api_admin_event_summary(integer)'),
  ('public.api_admin_freshness_sla()'),
  ('public.api_admin_get_business_metrics(date,integer)'),
  ('public.api_admin_get_event_summary(text,integer,text,text)'),
  ('public.api_admin_get_funnel(text[],integer,text)'),
  ('public.api_admin_get_submissions(text,integer,integer,text)'),
  ('public.api_admin_get_top_events(integer,integer,text)'),
  ('public.api_admin_health_overview()'),
  ('public.api_admin_migration_audit()'),
  ('public.api_admin_provenance_health()'),
  ('public.api_admin_review_submission(uuid,text,bigint)'),
  ('public.api_admin_scoring_drift()'),
  ('public.api_admin_search_quality(integer)'),
  ('public.api_admin_submission_velocity()'),
  ('public.admin_activate_scoring_version(text)'),
  ('public.admin_flag_overview()'),
  ('public.admin_provenance_dashboard(text)'),
  ('public.admin_rescore_batch(text,text,text,text,integer)'),
  ('public.admin_score_drift_report(numeric)'),
  ('public.admin_scoring_versions()'),
  ('public.admin_set_rollout(text,integer)'),
  ('public.admin_toggle_flag(text,boolean,text)'),
  ('public._compute_from_config(bigint,jsonb)'),
  ('public._explain_from_config(bigint,jsonb)'),
  ('public._score_submission_quality(uuid,text,text,text,text,text)'),
  ('public.aggregate_daily_metrics(date)'),
  ('public.api_get_event_schemas(text,text)'),
  ('public.audit_band_consistency()'),
  ('public.audit_category_consistency()'),
  ('public.audit_duplicate_eans()'),
  ('public.audit_impossible_values()'),
  ('public.audit_missing_required_fields()'),
  ('public.audit_mv_staleness()'),
  ('public.audit_orphan_records()'),
  ('public.audit_score_band_contradictions()'),
  ('public.auto_link_cross_country_products()'),
  ('public.capture_score_distribution()'),
  ('public.check_api_rate_limit(uuid,text)'),
  ('public.check_flag_readiness()'),
  ('public.check_formula_drift()'),
  ('public.check_function_source_drift()'),
  ('public.check_scan_rate_limit(uuid)'),
  ('public.check_share_limit(uuid,text)'),
  ('public.check_submission_rate_limit(uuid)'),
  ('public.check_table_ceilings()'),
  ('public.complete_backfill(uuid,integer,boolean)'),
  ('public.compute_provenance_confidence(bigint)'),
  ('public.compute_score(bigint,text,text,text)'),
  ('public.detect_conflict(bigint,text,text,jsonb)'),
  ('public.detect_score_drift(numeric)'),
  ('public.detect_stale_products(text,text,integer)'),
  ('public.execute_retention_cleanup(boolean,integer)'),
  ('public.expire_stale_flags()'),
  ('public.fail_backfill(uuid,text)'),
  ('public.flag_health_report()'),
  ('public.governance_drift_check()'),
  ('public.log_drift_check()'),
  ('public.metric_allergen_distribution()'),
  ('public.metric_category_popularity(date)'),
  ('public.metric_dau(date)'),
  ('public.metric_failed_searches(date)'),
  ('public.metric_feature_usage(date,date)'),
  ('public.metric_onboarding_funnel(date,date)'),
  ('public.metric_scan_vs_search(date)'),
  ('public.metric_searches_per_day(date)'),
  ('public.metric_top_products(date,integer)'),
  ('public.metric_top_queries(date,integer)'),
  ('public.mv_last_refresh()'),
  ('public.mv_staleness_check()'),
  ('public.record_bulk_provenance(bigint,text,text[],uuid,text)'),
  ('public.record_field_provenance(bigint,text,text,numeric,uuid,text,text)'),
  ('public.refresh_all_materialized_views(text)'),
  ('public.register_backfill(text,text,text,integer,integer,text,text)'),
  ('public.rescore_batch(text,text,text,text,integer)'),
  ('public.resolve_conflicts_auto(text,text)'),
  ('public.run_full_data_audit()'),
  ('public.score_submission_quality(uuid)'),
  ('public.search_quality_report(integer,text)'),
  ('public.snapshot_query_performance()'),
  ('public.start_backfill(uuid)'),
  ('public.update_backfill_progress(uuid,integer)'),
  ('public.validate_country_profile(text,text)'),
  ('public.validate_product_for_country(bigint,text)');

SELECT is(
  (SELECT count(*)::integer FROM private_beta_admin_routines),
  84,
  'privileged routine grant matrix contains the expected 84 signatures'
);

SELECT is(
  (SELECT count(*)::integer FROM private_beta_admin_routines WHERE to_regprocedure(signature) IS NULL),
  0,
  'every privileged routine signature resolves in the final schema'
);

SELECT is(
  (
    SELECT string_agg(pg_proc.proname, ',' ORDER BY pg_proc.proname)
    FROM private_beta_admin_routines
    JOIN pg_proc ON pg_proc.oid = to_regprocedure(signature)
    WHERE NOT pg_proc.prosecdef
  ),
  'check_flag_readiness,mv_staleness_check',
  'only the two reviewed read-only diagnostics remain SECURITY INVOKER'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM private_beta_admin_routines
    WHERE has_function_privilege('anon', to_regprocedure(signature), 'EXECUTE')
  ),
  0,
  'anon cannot execute any privileged routine'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM private_beta_admin_routines
    WHERE has_function_privilege('authenticated', to_regprocedure(signature), 'EXECUTE')
  ),
  0,
  'ordinary authenticated users cannot execute any privileged routine'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM private_beta_admin_routines
    WHERE has_function_privilege('service_role', to_regprocedure(signature), 'EXECUTE')
  ),
  84,
  'service_role can execute every privileged routine'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.api_admin_review_submission(uuid,text,bigint)',
    'EXECUTE'
  ),
  'authenticated cannot review or merge another user submission'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.api_admin_batch_reject_user(uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot batch-reject submissions or alter trust'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.admin_toggle_flag(text,boolean,text)',
    'EXECUTE'
  ),
  'anon cannot mutate feature-flag state'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.compute_score(bigint,text,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot run write-capable scoring operations'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM unnest(ARRAY[
      'public.api_admin_get_submissions(text,integer,integer)',
      'public.api_admin_get_event_summary(text,integer,text)',
      'public.api_admin_get_top_events(integer,integer)',
      'public.api_admin_get_funnel(text[],integer)'
    ]) AS obsolete(signature)
    WHERE to_regprocedure(signature) IS NOT NULL
  ),
  0,
  'obsolete admin overloads remain absent'
);

CREATE TEMP TABLE private_beta_admin_relations (
  relation_name text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO private_beta_admin_relations(relation_name) VALUES
  ('public.localization_metrics'),
  ('public.v_backfill_status'),
  ('public.v_completeness_by_country'),
  ('public.v_confidence_distribution'),
  ('public.v_cross_country_ean_candidates'),
  ('public.v_cross_country_scan_analytics'),
  ('public.v_data_coverage_summary'),
  ('public.v_data_freshness_sla'),
  ('public.v_data_freshness_summary'),
  ('public.v_data_gap_summary'),
  ('public.v_event_analytics_summary'),
  ('public.v_formula_registry'),
  ('public.v_index_bloat_estimate'),
  ('public.v_migration_audit'),
  ('public.v_missing_indexes'),
  ('public.v_provenance_health'),
  ('public.v_query_regressions'),
  ('public.v_scoring_drift'),
  ('public.v_search_quality'),
  ('public.v_submission_country_analytics'),
  ('public.v_unused_indexes');

SELECT is(
  (SELECT count(*)::integer FROM private_beta_admin_relations),
  21,
  'operational relation grant matrix contains the expected 21 relations'
);

SELECT is(
  (SELECT count(*)::integer FROM private_beta_admin_relations WHERE to_regclass(relation_name) IS NULL),
  0,
  'every operational relation resolves in the final schema'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM private_beta_admin_relations
    WHERE has_table_privilege('anon', to_regclass(relation_name), 'SELECT')
  ),
  0,
  'anon cannot select from operational relations'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM private_beta_admin_relations
    WHERE has_table_privilege('authenticated', to_regclass(relation_name), 'SELECT')
  ),
  0,
  'ordinary authenticated users cannot select from operational relations'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM private_beta_admin_relations
    WHERE has_table_privilege('service_role', to_regclass(relation_name), 'SELECT')
  ),
  21,
  'service_role can select from every operational relation'
);

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.api_admin_health_overview()$$,
  '42501',
  NULL,
  'anon receives permission denied when calling an admin RPC'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.api_admin_health_overview()$$,
  '42501',
  NULL,
  'authenticated receives permission denied when calling an admin RPC'
);
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT * FROM public.v_provenance_health LIMIT 0$$,
  '42501',
  NULL,
  'anon receives permission denied when reading an operations view'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT * FROM public.v_provenance_health LIMIT 0$$,
  '42501',
  NULL,
  'authenticated receives permission denied when reading an operations view'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
