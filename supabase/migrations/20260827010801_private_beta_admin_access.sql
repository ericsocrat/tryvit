-- Migration: lock private-beta administration and operations surfaces to service_role.
-- Rollback: append a compensating migration with explicit reviewed grants; never
--           restore the vulnerable blanket client privileges.
--
-- Private-beta database authorization boundary.
--
-- The routines below are privileged administration, governance, analytics,
-- scoring, provenance, backfill, audit, or maintenance operations. None is a
-- supported browser RPC. Existing default ACLs made them reachable by anon or
-- authenticated even where an earlier migration also granted service_role.
-- Revoke every inherited/direct client privilege first, then grant only the
-- exact server role needed by operational tooling.

BEGIN;

DO $migration$
DECLARE
  routine_signature text;
BEGIN
  FOREACH routine_signature IN ARRAY ARRAY[
    -- Explicit admin API.
    'public.api_admin_batch_reject_user(uuid,text)',
    'public.api_admin_event_summary(integer)',
    'public.api_admin_freshness_sla()',
    'public.api_admin_get_business_metrics(date,integer)',
    'public.api_admin_get_event_summary(text,integer,text,text)',
    'public.api_admin_get_funnel(text[],integer,text)',
    'public.api_admin_get_submissions(text,integer,integer,text)',
    'public.api_admin_get_top_events(integer,integer,text)',
    'public.api_admin_health_overview()',
    'public.api_admin_migration_audit()',
    'public.api_admin_provenance_health()',
    'public.api_admin_review_submission(uuid,text,bigint)',
    'public.api_admin_scoring_drift()',
    'public.api_admin_search_quality(integer)',
    'public.api_admin_submission_velocity()',

    -- Non-api admin entry points.
    'public.admin_activate_scoring_version(text)',
    'public.admin_flag_overview()',
    'public.admin_provenance_dashboard(text)',
    'public.admin_rescore_batch(text,text,text,text,integer)',
    'public.admin_score_drift_report(numeric)',
    'public.admin_scoring_versions()',
    'public.admin_set_rollout(text,integer)',
    'public.admin_toggle_flag(text,boolean,text)',

    -- Internal scoring, analytics, provenance, backfill, audit, and operations.
    'public._compute_from_config(bigint,jsonb)',
    'public._explain_from_config(bigint,jsonb)',
    'public._score_submission_quality(uuid,text,text,text,text,text)',
    'public.aggregate_daily_metrics(date)',
    'public.api_get_event_schemas(text,text)',
    'public.audit_band_consistency()',
    'public.audit_category_consistency()',
    'public.audit_duplicate_eans()',
    'public.audit_impossible_values()',
    'public.audit_missing_required_fields()',
    'public.audit_mv_staleness()',
    'public.audit_orphan_records()',
    'public.audit_score_band_contradictions()',
    'public.auto_link_cross_country_products()',
    'public.capture_score_distribution()',
    'public.check_api_rate_limit(uuid,text)',
    'public.check_flag_readiness()',
    'public.check_formula_drift()',
    'public.check_function_source_drift()',
    'public.check_scan_rate_limit(uuid)',
    'public.check_share_limit(uuid,text)',
    'public.check_submission_rate_limit(uuid)',
    'public.check_table_ceilings()',
    'public.complete_backfill(uuid,integer,boolean)',
    'public.compute_provenance_confidence(bigint)',
    'public.compute_score(bigint,text,text,text)',
    'public.detect_conflict(bigint,text,text,jsonb)',
    'public.detect_score_drift(numeric)',
    'public.detect_stale_products(text,text,integer)',
    'public.execute_retention_cleanup(boolean,integer)',
    'public.expire_stale_flags()',
    'public.fail_backfill(uuid,text)',
    'public.flag_health_report()',
    'public.governance_drift_check()',
    'public.log_drift_check()',
    'public.metric_allergen_distribution()',
    'public.metric_category_popularity(date)',
    'public.metric_dau(date)',
    'public.metric_failed_searches(date)',
    'public.metric_feature_usage(date,date)',
    'public.metric_onboarding_funnel(date,date)',
    'public.metric_scan_vs_search(date)',
    'public.metric_searches_per_day(date)',
    'public.metric_top_products(date,integer)',
    'public.metric_top_queries(date,integer)',
    'public.mv_last_refresh()',
    'public.mv_staleness_check()',
    'public.record_bulk_provenance(bigint,text,text[],uuid,text)',
    'public.record_field_provenance(bigint,text,text,numeric,uuid,text,text)',
    'public.refresh_all_materialized_views(text)',
    'public.register_backfill(text,text,text,integer,integer,text,text)',
    'public.rescore_batch(text,text,text,text,integer)',
    'public.resolve_conflicts_auto(text,text)',
    'public.run_full_data_audit()',
    'public.score_submission_quality(uuid)',
    'public.search_quality_report(integer,text)',
    'public.snapshot_query_performance()',
    'public.start_backfill(uuid)',
    'public.update_backfill_progress(uuid,integer)',
    'public.validate_country_profile(text,text)',
    'public.validate_product_for_country(bigint,text)'
  ]
  LOOP
    IF to_regprocedure(routine_signature) IS NULL THEN
      RAISE EXCEPTION 'Expected privileged routine is missing: %', routine_signature;
    END IF;

    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',
      routine_signature
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      routine_signature
    );
  END LOOP;
END;
$migration$;

-- These relations are operational reporting surfaces rather than browser data
-- contracts. Ordinary views run with their owner's privileges by default; the
-- materialized coverage summary also bypasses table RLS. Keep every one behind
-- the service role without changing its definition or refresh behavior.
DO $migration$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'public.localization_metrics',
    'public.v_backfill_status',
    'public.v_completeness_by_country',
    'public.v_confidence_distribution',
    'public.v_cross_country_ean_candidates',
    'public.v_cross_country_scan_analytics',
    'public.v_data_coverage_summary',
    'public.v_data_freshness_sla',
    'public.v_data_freshness_summary',
    'public.v_data_gap_summary',
    'public.v_event_analytics_summary',
    'public.v_formula_registry',
    'public.v_index_bloat_estimate',
    'public.v_migration_audit',
    'public.v_missing_indexes',
    'public.v_provenance_health',
    'public.v_query_regressions',
    'public.v_scoring_drift',
    'public.v_search_quality',
    'public.v_submission_country_analytics',
    'public.v_unused_indexes'
  ]
  LOOP
    IF to_regclass(relation_name) IS NULL THEN
      RAISE EXCEPTION 'Expected operational relation is missing: %', relation_name;
    END IF;

    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %s FROM PUBLIC, anon, authenticated, service_role',
      relation_name
    );
    EXECUTE format('GRANT SELECT ON TABLE %s TO service_role', relation_name);
  END LOOP;
END;
$migration$;

COMMIT;
