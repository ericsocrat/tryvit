-- ─── pgTAP: Personalized Dashboard function tests ────────────────────────────
-- Tests for api_record_product_view, api_get_recently_viewed,
-- api_get_dashboard_data.
-- Run via: supabase test db
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;
SELECT plan(20);

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. api_record_product_view — basic contract
-- ═══════════════════════════════════════════════════════════════════════════

SELECT lives_ok(
  $$SELECT public.api_record_product_view(1)$$,
  'api_record_product_view does not throw'
);

SELECT is(
  (public.api_record_product_view(1))->>'api_version',
  '1.0',
  'api_record_product_view returns api_version'
);

SELECT ok(
  (public.api_record_product_view(1)) ? 'error',
  'api_record_product_view returns error when unauthenticated'
);

SELECT is(
  (public.api_record_product_view(1))->>'error',
  'Authentication required',
  'api_record_product_view auth error message is correct'
);

-- NULL product_id still handled gracefully (auth check first)
SELECT lives_ok(
  $$SELECT public.api_record_product_view(NULL)$$,
  'api_record_product_view with NULL product does not throw'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. api_get_recently_viewed — basic contract
-- ═══════════════════════════════════════════════════════════════════════════

SELECT lives_ok(
  $$SELECT public.api_get_recently_viewed()$$,
  'api_get_recently_viewed does not throw with defaults'
);

SELECT lives_ok(
  $$SELECT public.api_get_recently_viewed(5)$$,
  'api_get_recently_viewed does not throw with custom limit'
);

SELECT lives_ok(
  $$SELECT public.api_get_recently_viewed(0)$$,
  'api_get_recently_viewed does not throw with 0 limit (clamped to 1)'
);

SELECT lives_ok(
  $$SELECT public.api_get_recently_viewed(100)$$,
  'api_get_recently_viewed does not throw with 100 limit (clamped to 50)'
);

SELECT is(
  (public.api_get_recently_viewed())->>'api_version',
  '1.0',
  'api_get_recently_viewed returns api_version'
);

SELECT ok(
  (public.api_get_recently_viewed()) ? 'error',
  'api_get_recently_viewed returns error when unauthenticated'
);

SELECT is(
  (public.api_get_recently_viewed())->>'error',
  'Authentication required',
  'api_get_recently_viewed auth error message is correct'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. api_get_dashboard_data — basic contract
-- ═══════════════════════════════════════════════════════════════════════════

SELECT lives_ok(
  $$SELECT public.api_get_dashboard_data()$$,
  'api_get_dashboard_data does not throw'
);

SELECT is(
  (public.api_get_dashboard_data())->>'api_version',
  '1.0',
  'api_get_dashboard_data returns api_version'
);

SELECT ok(
  (public.api_get_dashboard_data()) ? 'error',
  'api_get_dashboard_data returns error when unauthenticated'
);

SELECT is(
  (public.api_get_dashboard_data())->>'error',
  'Authentication required',
  'api_get_dashboard_data auth error message is correct'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. api_dashboard_insights — basic contract
--    Regression for column li.created_at -> li.added_at
--    (user_product_list_items has added_at, not created_at).
-- ═══════════════════════════════════════════════════════════════════════════

-- Would throw 42703 if the score-trend ORDER BY referenced a missing column.
SELECT lives_ok(
  $$SELECT public.api_dashboard_insights()$$,
  'api_dashboard_insights does not throw'
);

SELECT ok(
  (public.api_dashboard_insights()) ? 'error',
  'api_dashboard_insights returns error when unauthenticated'
);

SELECT is(
  (public.api_dashboard_insights())->>'error',
  'unauthorized',
  'api_dashboard_insights auth error message is correct'
);

-- Authenticated path: with auth.uid() set, the function executes the full
-- body including the score-trend ORDER BY. This is the assertion that would
-- have caught the original 42703 (li.created_at) regression — the
-- unauthenticated lives_ok above early-returns before reaching that query.
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000001"}';

SELECT lives_ok(
  $$SELECT public.api_dashboard_insights()$$,
  'api_dashboard_insights executes score-trend query without error (added_at regression guard)'
);

SELECT * FROM finish();
ROLLBACK;
