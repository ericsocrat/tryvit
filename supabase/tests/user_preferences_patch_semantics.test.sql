-- pgTAP: authenticated PATCH semantics for api_set_user_preferences().
-- Run via: supabase test db supabase/tests/user_preferences_patch_semantics.test.sql

BEGIN;
SELECT plan(12);

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
VALUES
  (
    '00000000-0000-0000-0000-00000000e200'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-preference-patch-a@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-00000000e201'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-preference-patch-b@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000e200';
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000e200","role":"authenticated"}';

SELECT ok(
  NOT (public.api_set_user_preferences(
    p_country := 'PL',
    p_diet_preference := 'vegan',
    p_avoid_allergens := ARRAY['gluten', 'milk']::text[],
    p_strict_allergen := true,
    p_strict_diet := true,
    p_treat_may_contain_as_unsafe := true,
    p_preferred_language := 'en',
    p_notification_score_changes := false,
    p_notification_frequency := 'weekly_digest'
  ) ? 'error'),
  'an authenticated caller can create a complete preference row'
);

SELECT is(
  (
    SELECT jsonb_build_object(
      'country', country,
      'language', preferred_language,
      'diet', diet_preference,
      'allergens', avoid_allergens,
      'strict_allergen', strict_allergen,
      'strict_diet', strict_diet,
      'treat_may_contain', treat_may_contain_as_unsafe,
      'notify', notification_score_changes,
      'frequency', notification_frequency
    )
    FROM public.user_preferences
    WHERE user_id = '00000000-0000-0000-0000-00000000e200'::uuid
  ),
  '{"country":"PL","language":"en","diet":"vegan","allergens":["gluten","milk"],"strict_allergen":true,"strict_diet":true,"treat_may_contain":true,"notify":false,"frequency":"weekly_digest"}'::jsonb,
  'the complete preference row stores every supplied domain'
);

SELECT ok(
  NOT (public.api_set_user_preferences(
    p_country := 'DE',
    p_preferred_language := 'de'
  ) ? 'error'),
  'a profile-only PATCH succeeds'
);

SELECT is(
  (
    SELECT jsonb_build_object(
      'country', country,
      'language', preferred_language,
      'diet', diet_preference,
      'allergens', avoid_allergens,
      'strict_allergen', strict_allergen,
      'strict_diet', strict_diet,
      'treat_may_contain', treat_may_contain_as_unsafe,
      'notify', notification_score_changes,
      'frequency', notification_frequency
    )
    FROM public.user_preferences
    WHERE user_id = '00000000-0000-0000-0000-00000000e200'::uuid
  ),
  '{"country":"DE","language":"de","diet":"vegan","allergens":["gluten","milk"],"strict_allergen":true,"strict_diet":true,"treat_may_contain":true,"notify":false,"frequency":"weekly_digest"}'::jsonb,
  'profile-only PATCH preserves nutrition and notification fields'
);

SELECT ok(
  NOT (public.api_set_user_preferences(
    p_diet_preference := 'vegetarian',
    p_avoid_allergens := ARRAY[]::text[],
    p_strict_allergen := false,
    p_strict_diet := false,
    p_treat_may_contain_as_unsafe := false
  ) ? 'error'),
  'a nutrition-only PATCH can explicitly clear allergens'
);

SELECT is(
  (
    SELECT jsonb_build_object(
      'country', country,
      'language', preferred_language,
      'diet', diet_preference,
      'allergens', avoid_allergens,
      'strict_allergen', strict_allergen,
      'strict_diet', strict_diet,
      'treat_may_contain', treat_may_contain_as_unsafe,
      'notify', notification_score_changes,
      'frequency', notification_frequency
    )
    FROM public.user_preferences
    WHERE user_id = '00000000-0000-0000-0000-00000000e200'::uuid
  ),
  '{"country":"DE","language":"de","diet":"vegetarian","allergens":[],"strict_allergen":false,"strict_diet":false,"treat_may_contain":false,"notify":false,"frequency":"weekly_digest"}'::jsonb,
  'nutrition-only PATCH preserves profile and notification fields'
);

SELECT ok(
  NOT (public.api_set_user_preferences(
    p_notification_score_changes := true,
    p_notification_frequency := 'daily_digest'
  ) ? 'error'),
  'a notification-only PATCH succeeds'
);

SELECT is(
  (
    SELECT jsonb_build_object(
      'country', country,
      'language', preferred_language,
      'diet', diet_preference,
      'allergens', avoid_allergens,
      'strict_allergen', strict_allergen,
      'strict_diet', strict_diet,
      'treat_may_contain', treat_may_contain_as_unsafe,
      'notify', notification_score_changes,
      'frequency', notification_frequency
    )
    FROM public.user_preferences
    WHERE user_id = '00000000-0000-0000-0000-00000000e200'::uuid
  ),
  '{"country":"DE","language":"de","diet":"vegetarian","allergens":[],"strict_allergen":false,"strict_diet":false,"treat_may_contain":false,"notify":true,"frequency":"daily_digest"}'::jsonb,
  'notification-only PATCH preserves profile and nutrition fields'
);

SELECT ok(
  NOT (public.api_set_user_preferences(
    p_diet_preference := NULL,
    p_avoid_allergens := NULL,
    p_strict_allergen := NULL,
    p_strict_diet := NULL,
    p_treat_may_contain_as_unsafe := NULL
  ) ? 'error'),
  'explicit NULL PATCH values succeed'
);

SELECT is(
  (
    SELECT jsonb_build_object(
      'diet', diet_preference,
      'allergens', avoid_allergens,
      'strict_allergen', strict_allergen,
      'strict_diet', strict_diet,
      'treat_may_contain', treat_may_contain_as_unsafe
    )
    FROM public.user_preferences
    WHERE user_id = '00000000-0000-0000-0000-00000000e200'::uuid
  ),
  '{"diet":"vegetarian","allergens":[],"strict_allergen":false,"strict_diet":false,"treat_may_contain":false}'::jsonb,
  'NULL PATCH values preserve existing nutrition fields'
);

SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000e201';
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000e201","role":"authenticated"}';

SELECT ok(
  NOT (public.api_set_user_preferences() ? 'error'),
  'an all-NULL first call creates a default preference row'
);

SELECT is(
  (
    SELECT jsonb_build_object(
      'country', country,
      'language', preferred_language,
      'diet', diet_preference,
      'allergens', avoid_allergens,
      'strict_allergen', strict_allergen,
      'strict_diet', strict_diet,
      'treat_may_contain', treat_may_contain_as_unsafe,
      'notify', notification_score_changes,
      'frequency', notification_frequency
    )
    FROM public.user_preferences
    WHERE user_id = '00000000-0000-0000-0000-00000000e201'::uuid
  ),
  '{"country":null,"language":"en","diet":null,"allergens":null,"strict_allergen":false,"strict_diet":false,"treat_may_contain":false,"notify":true,"frequency":"immediate"}'::jsonb,
  'NULL inputs resolve to preference defaults only on insert'
);

SELECT * FROM finish();
ROLLBACK;
