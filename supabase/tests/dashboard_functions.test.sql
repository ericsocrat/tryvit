-- ─── pgTAP: Personalized Dashboard function tests ────────────────────────────
-- Tests for api_record_product_view, api_get_recently_viewed,
-- api_get_dashboard_data.
-- Run via: supabase test db
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;
SELECT plan(24);

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

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. api_dashboard_insights favorites semantic hardening
--    Favorites are identified by list_type='favorites' and must continue
--    to work even if the display name is renamed/localized.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  'authenticated',
  'authenticated',
  'pgtap-dashboard-favorites@example.com',
  crypt('password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.category_ref (category, slug, display_name, sort_order, is_active)
VALUES ('pgtap-dashboard-cat', 'pgtap-dashboard-cat', 'pgTAP Dashboard Cat', 998, true)
ON CONFLICT (category) DO UPDATE SET slug = 'pgtap-dashboard-cat';

INSERT INTO public.country_ref (country_code, country_name, is_active)
VALUES ('XY', 'Dashboard Test Country', true)
ON CONFLICT (country_code) DO NOTHING;

INSERT INTO public.products (
  product_id, ean, product_name, brand, category, country,
  unhealthiness_score, nutri_score_label, nova_classification
) VALUES (
  999982, '5901234888099', 'pgTAP Dashboard Favorite Product', 'DashboardBrand',
  'pgtap-dashboard-cat', 'XY', 42, 'B', '2'
)
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO public.user_product_lists (
  id, user_id, name, is_default, list_type, share_enabled
) VALUES (
  '11111111-2222-3333-4444-555555555555'::uuid,
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  'Ulubione (renamed)',
  true,
  'favorites',
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_product_list_items (
  id, list_id, product_id, position, notes, added_at
) VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  '11111111-2222-3333-4444-555555555555'::uuid,
  999982,
  0,
  NULL,
  now()
)
ON CONFLICT (list_id, product_id) DO NOTHING;

SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

SELECT ok(
  NOT ((public.api_dashboard_insights()) ? 'error'),
  'api_dashboard_insights succeeds for renamed favorites list'
);

SELECT is(
  ((public.api_dashboard_insights())->>'avg_score')::numeric,
  42.0::numeric,
  'api_dashboard_insights includes renamed favorites list_type data in avg_score'
);

SELECT ok(
  (public.api_dashboard_insights()) ? 'score_trend',
  'api_dashboard_insights includes score_trend key'
);

SELECT ok(
  (public.api_dashboard_insights()) ? 'nova_distribution',
  'api_dashboard_insights includes nova_distribution key'
);

SELECT * FROM finish();
ROLLBACK;
