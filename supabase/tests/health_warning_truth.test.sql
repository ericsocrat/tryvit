-- pgTAP: personalized health-warning evidence truthfulness.
-- Run via: supabase test db supabase/tests/health_warning_truth.test.sql

BEGIN;
SELECT plan(25);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-00000000e100'::uuid,
  'authenticated',
  'authenticated',
  'pgtap-health-truth@example.com',
  crypt('password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.category_ref (category, slug, display_name, sort_order, is_active)
VALUES ('pgtap-health-truth', 'pgtap-health-truth', 'pgTAP Health Truth', 996, true)
ON CONFLICT (category) DO UPDATE SET slug = 'pgtap-health-truth';

INSERT INTO public.country_ref (country_code, country_name, is_active)
VALUES ('XZ', 'Health Truth Test Country', true)
ON CONFLICT (country_code) DO NOTHING;

INSERT INTO public.products (
  product_id, ean, product_name, brand, category, country,
  unhealthiness_score, nutri_score_label, nova_classification,
  high_salt_flag, high_sugar_flag, high_sat_fat_flag
)
VALUES
  (999970, '5901234999970', 'Canonical Gluten Product', 'Test Brand',
   'pgtap-health-truth', 'XZ', 50, 'C', '3', 'NO', 'NO', 'NO'),
  (999971, '5901234999971', 'Complete Low Sugar Product', 'Test Brand',
   'pgtap-health-truth', 'XZ', 20, 'A', '1', 'NO', 'NO', 'NO'),
  (999972, '5901234999972', 'Missing Nutrition Product', 'Test Brand',
   'pgtap-health-truth', 'XZ', 20, 'A', '1', 'NO', 'NO', 'NO'),
  (999973, '5901234999973', 'Gluten Trace Product', 'Test Brand',
   'pgtap-health-truth', 'XZ', 30, 'B', '2', 'NO', 'NO', 'NO'),
  (999974, '5901234999974', 'Partial Nutrition Product', 'Test Brand',
   'pgtap-health-truth', 'XZ', 30, 'B', '2', 'NO', 'NO', 'NO')
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO public.nutrition_facts (
  product_id, calories, total_fat_g, saturated_fat_g,
  carbs_g, sugars_g, protein_g, salt_g
)
VALUES
  (999970, '200', '8.0', '3.0', '25.0', '6.0', '5.0', '0.2'),
  (999971, '100', '2.0', '0.5', '15.0', '3.0', '4.0', '0.1'),
  (999973, '150', '4.0', '1.0', '20.0', '5.0', '3.0', '0.2'),
  (999974, NULL, NULL, NULL, NULL, '12.0', NULL, NULL)
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO public.product_allergen_info (product_id, tag, type)
VALUES
  (999970, 'gluten', 'contains'),
  (999973, 'gluten', 'traces')
ON CONFLICT (product_id, tag, type) DO NOTHING;

INSERT INTO public.user_health_profiles (
  profile_id, user_id, profile_name, is_active, health_conditions
)
VALUES
  ('00000000-0000-0000-0000-00000000e101'::uuid,
   '00000000-0000-0000-0000-00000000e100'::uuid,
   'Celiac', false, ARRAY['celiac_disease']::text[]),
  ('00000000-0000-0000-0000-00000000e102'::uuid,
   '00000000-0000-0000-0000-00000000e100'::uuid,
   'Heart', false, ARRAY['heart_disease']::text[]),
  ('00000000-0000-0000-0000-00000000e103'::uuid,
   '00000000-0000-0000-0000-00000000e100'::uuid,
   'Diabetes', false, ARRAY['diabetes']::text[]),
  ('00000000-0000-0000-0000-00000000e104'::uuid,
   '00000000-0000-0000-0000-00000000e100'::uuid,
   'No checks', false, ARRAY[]::text[])
ON CONFLICT (profile_id) DO NOTHING;

SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000e100';
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000e100","role":"authenticated"}';

SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(public.compute_health_warnings(
      999970,
      '00000000-0000-0000-0000-00000000e101'::uuid
    )) warning
    WHERE warning->>'condition' = 'celiac_disease'
  ),
  'canonical bare gluten tag produces a celiac warning'
);

SELECT is(
  (public.compute_health_warnings(
    999970,
    '00000000-0000-0000-0000-00000000e101'::uuid
  )->0->>'severity'),
  'critical',
  'canonical gluten evidence remains a critical warning'
);

SELECT is(
  (public.api_product_health_warnings(
    999970,
    '00000000-0000-0000-0000-00000000e101'::uuid
  )->>'warning_count')::integer,
  1,
  'legacy warning_count is retained'
);

SELECT ok(
  (public.api_product_health_warnings(
    999970,
    '00000000-0000-0000-0000-00000000e101'::uuid
  )->'warnings') @> '[{"condition":"celiac_disease"}]'::jsonb,
  'legacy warnings array is retained'
);

SELECT is(
  public.api_product_health_warnings(
    999970,
    '00000000-0000-0000-0000-00000000e101'::uuid
  )->'evidence_completeness'->>'status',
  'complete',
  'positive gluten evidence completes the celiac disposition'
);

SELECT is(
  public.api_product_health_warnings(
    999970,
    '00000000-0000-0000-0000-00000000e101'::uuid
  )->>'evaluation_disposition',
  'evaluated',
  'known positive gluten evidence is fully evaluated'
);

SELECT is(
  (public.api_product_health_warnings(
    999973,
    '00000000-0000-0000-0000-00000000e101'::uuid
  )->>'warning_count')::integer,
  1,
  'known gluten trace evidence produces a celiac warning'
);

SELECT like(
  public.api_product_health_warnings(
    999973,
    '00000000-0000-0000-0000-00000000e101'::uuid
  )->'warnings'->0->>'message',
  'May contain gluten traces%',
  'gluten trace warning remains qualified as may contain'
);

SELECT is(
  public.api_product_health_warnings(
    999973,
    '00000000-0000-0000-0000-00000000e101'::uuid
  )->>'evaluation_disposition',
  'evaluated',
  'known gluten trace evidence completes the celiac assessment'
);

SELECT is(
  (public.api_product_health_warnings(
    999971,
    '00000000-0000-0000-0000-00000000e101'::uuid
  )->>'warning_count')::integer,
  0,
  'missing positive gluten evidence does not fabricate a warning'
);

SELECT is(
  public.api_product_health_warnings(
    999971,
    '00000000-0000-0000-0000-00000000e101'::uuid
  )->>'evaluation_disposition',
  'withheld',
  'positive-only allergen storage withholds a celiac all-clear'
);

SELECT is(
  public.api_product_health_warnings(
    999971,
    '00000000-0000-0000-0000-00000000e101'::uuid
  )->'evidence_completeness'->>'status',
  'incomplete',
  'missing gluten absence assessment is incomplete evidence'
);

SELECT ok(
  (public.api_product_health_warnings(
    999971,
    '00000000-0000-0000-0000-00000000e101'::uuid
  )->'evidence_completeness'->'missing')
    ? 'celiac_disease.gluten_assessment',
  'response names the missing celiac evidence boundary'
);

SELECT is(
  (public.api_product_health_warnings(
    999972,
    '00000000-0000-0000-0000-00000000e102'::uuid
  )->>'warning_count')::integer,
  0,
  'derived NO flags do not fabricate a heart warning'
);

SELECT is(
  public.api_product_health_warnings(
    999972,
    '00000000-0000-0000-0000-00000000e102'::uuid
  )->>'evaluation_disposition',
  'withheld',
  'derived NO flags cannot create a heart all-clear without raw nutrition'
);

SELECT ok(
  (public.api_product_health_warnings(
    999972,
    '00000000-0000-0000-0000-00000000e102'::uuid
  )->'evidence_completeness'->'missing')
    ? 'heart_disease.saturated_fat_g',
  'heart evaluation requires raw saturated fat'
);

SELECT ok(
  (public.api_product_health_warnings(
    999972,
    '00000000-0000-0000-0000-00000000e102'::uuid
  )->'evidence_completeness'->'missing')
    ? 'heart_disease.salt_g',
  'heart evaluation requires raw salt'
);

SELECT is(
  public.api_product_health_warnings(
    999971,
    '00000000-0000-0000-0000-00000000e103'::uuid
  )->'evidence_completeness'->>'status',
  'complete',
  'available raw sugar plus a classified flag completes diabetes evidence'
);

SELECT is(
  public.api_product_health_warnings(
    999971,
    '00000000-0000-0000-0000-00000000e103'::uuid
  )->>'evaluation_disposition',
  'evaluated',
  'complete low-sugar evidence permits evaluation'
);

SELECT is(
  (public.api_product_health_warnings(
    999974,
    '00000000-0000-0000-0000-00000000e103'::uuid
  )->>'warning_count')::integer,
  1,
  'relevant sugar evidence still produces a warning when unrelated nutrients are null'
);

SELECT ok(
  (public.api_product_health_warnings(
    999974,
    '00000000-0000-0000-0000-00000000e103'::uuid
  )->'warnings') @> '[{"condition":"diabetes","severity":"moderate"}]'::jsonb,
  'partial nutrition rows do not suppress a valid sugar warning'
);

SELECT is(
  public.api_product_health_warnings(
    999971,
    '00000000-0000-0000-0000-00000000e104'::uuid
  )->>'evaluation_disposition',
  'not_applicable',
  'profile with no configured checks is not presented as an all-clear'
);

SELECT is(
  public.api_product_health_warnings(
    999971,
    '00000000-0000-0000-0000-00000000e104'::uuid
  )->'evidence_completeness'->>'status',
  'not_applicable',
  'no configured checks has an explicit evidence status'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.api_product_health_warnings(bigint,uuid)',
    'EXECUTE'
  ),
  'anonymous role cannot execute the health-warning RPC'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.api_product_health_warnings(bigint,uuid)',
    'EXECUTE'
  ),
  'authenticated role retains health-warning RPC access'
);

SELECT * FROM finish();
ROLLBACK;
