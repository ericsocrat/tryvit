-- Current owner preferences and onboarding; generated local identity, always rolled back.
BEGIN;
CREATE TEMP TABLE qa_identity AS SELECT gen_random_uuid() uid;
INSERT INTO auth.users(id) SELECT uid FROM qa_identity;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true) FROM qa_identity;

SELECT '1. preferences expose onboarding state' AS check_name,CASE WHEN public.api_get_user_preferences() ? 'onboarding_complete' THEN 0 ELSE 1 END AS violations;
SELECT '2. preferences belong to the generated identity' AS check_name,CASE WHEN public.api_get_user_preferences()->>'user_id'=(SELECT uid::text FROM qa_identity) THEN 0 ELSE 1 END AS violations;
SELECT '3. explicit onboarding completion persists a valid country' AS check_name,CASE WHEN public.api_complete_onboarding('{"country":"PL"}'::jsonb)->>'onboarding_complete'='true' AND public.api_get_user_preferences()->>'country'='PL' THEN 0 ELSE 1 END AS violations;
SELECT '4. unsupported country is rejected' AS check_name,CASE WHEN public.api_set_user_preferences(p_country:='XX') ? 'error' THEN 0 ELSE 1 END AS violations;
SELECT '5. unsupported dietary preference is rejected' AS check_name,CASE WHEN public.api_set_user_preferences(p_country:='PL',p_diet_preference:='pescatarian') ? 'error' THEN 0 ELSE 1 END AS violations;
SELECT set_config('request.jwt.claims','{}',true);
SELECT '6. anonymous country fallback is a valid active market' AS check_name,CASE WHEN EXISTS(SELECT 1 FROM public.country_ref WHERE country_code=public.resolve_effective_country(NULL) AND is_active) THEN 0 ELSE 1 END AS violations;
SELECT '7. country parameter default remains NULL' AS check_name,CASE WHEN pg_get_function_arguments('public.api_set_user_preferences'::regproc) LIKE '%p_country text DEFAULT NULL%' THEN 0 ELSE 1 END AS violations;
SELECT '8. pre-onboarding country remains nullable' AS check_name,CASE WHEN (SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='user_preferences' AND column_name='country')='YES' THEN 0 ELSE 1 END AS violations;
ROLLBACK;
