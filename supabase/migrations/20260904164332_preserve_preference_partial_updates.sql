-- Migration: Preserve user-preference domains during partial updates
-- Issue:     New-user journey preference-integrity audit
-- Rollback:  Restore api_set_user_preferences() from
--            20260315001810_notification_preferences.sql.
--
-- NULL means "not supplied" on update. On insert, NULL resolves to the
-- preference defaults. A non-NULL empty text array remains an explicit value,
-- allowing callers to intentionally clear avoided allergens.

BEGIN;

CREATE OR REPLACE FUNCTION public.api_set_user_preferences(
    p_country                     text     DEFAULT NULL,
    p_diet_preference             text     DEFAULT NULL,
    p_avoid_allergens             text[]   DEFAULT NULL,
    p_strict_allergen             boolean  DEFAULT NULL,
    p_strict_diet                 boolean  DEFAULT NULL,
    p_treat_may_contain_as_unsafe boolean  DEFAULT NULL,
    p_preferred_language          text     DEFAULT NULL,
    p_notification_score_changes  boolean  DEFAULT NULL,
    p_notification_frequency      text     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_uid uuid;
    v_current_country text;
    v_effective_language text;
    v_country_default_lang text;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object(
            'api_version', '1.0',
            'error', 'Authentication required.'
        );
    END IF;

    IF p_country IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM country_ref
            WHERE country_code = p_country
              AND is_active = true
        ) THEN
            RETURN jsonb_build_object(
                'api_version', '1.0',
                'error', 'Country not available: ' || p_country
            );
        END IF;
    END IF;

    IF p_diet_preference IS NOT NULL
       AND p_diet_preference NOT IN ('none', 'vegetarian', 'vegan')
    THEN
        RETURN jsonb_build_object(
            'api_version', '1.0',
            'error', 'Invalid diet_preference. Use: none, vegetarian, vegan.'
        );
    END IF;

    IF p_preferred_language IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM language_ref
            WHERE code = p_preferred_language
              AND is_enabled = true
        ) THEN
            RETURN jsonb_build_object(
                'api_version', '1.0',
                'error', 'Invalid preferred_language. Enabled: ' ||
                    (SELECT string_agg(code, ', ' ORDER BY sort_order)
                     FROM language_ref
                     WHERE is_enabled = true)
            );
        END IF;
    END IF;

    IF p_notification_frequency IS NOT NULL
       AND p_notification_frequency NOT IN (
           'immediate',
           'daily_digest',
           'weekly_digest'
       )
    THEN
        RETURN jsonb_build_object(
            'api_version', '1.0',
            'error', 'Invalid notification_frequency. Use: immediate, daily_digest, weekly_digest.'
        );
    END IF;

    -- Preserve the established country-driven language behavior. Supplying a
    -- changed country without a language selects that country's default;
    -- omitting both leaves an existing language untouched.
    IF p_country IS NOT NULL AND p_preferred_language IS NULL THEN
        SELECT country
        INTO v_current_country
        FROM user_preferences
        WHERE user_id = v_uid;

        IF v_current_country IS NULL OR v_current_country <> p_country THEN
            SELECT default_language
            INTO v_country_default_lang
            FROM country_ref
            WHERE country_code = p_country;

            IF v_country_default_lang IS NOT NULL THEN
                v_effective_language := v_country_default_lang;
            END IF;
        END IF;
    END IF;

    v_effective_language := COALESCE(
        p_preferred_language,
        v_effective_language
    );

    INSERT INTO user_preferences (
        user_id,
        country,
        diet_preference,
        avoid_allergens,
        strict_allergen,
        strict_diet,
        treat_may_contain_as_unsafe,
        preferred_language,
        notification_score_changes,
        notification_frequency
    ) VALUES (
        v_uid,
        p_country,
        p_diet_preference,
        p_avoid_allergens,
        COALESCE(p_strict_allergen, false),
        COALESCE(p_strict_diet, false),
        COALESCE(p_treat_may_contain_as_unsafe, false),
        COALESCE(v_effective_language, 'en'),
        COALESCE(p_notification_score_changes, true),
        COALESCE(p_notification_frequency, 'immediate')
    )
    ON CONFLICT (user_id) DO UPDATE SET
        country = COALESCE(p_country, user_preferences.country),
        diet_preference = COALESCE(
            p_diet_preference,
            user_preferences.diet_preference
        ),
        avoid_allergens = COALESCE(
            p_avoid_allergens,
            user_preferences.avoid_allergens
        ),
        strict_allergen = COALESCE(
            p_strict_allergen,
            user_preferences.strict_allergen
        ),
        strict_diet = COALESCE(
            p_strict_diet,
            user_preferences.strict_diet
        ),
        treat_may_contain_as_unsafe = COALESCE(
            p_treat_may_contain_as_unsafe,
            user_preferences.treat_may_contain_as_unsafe
        ),
        preferred_language = COALESCE(
            v_effective_language,
            user_preferences.preferred_language
        ),
        notification_score_changes = COALESCE(
            p_notification_score_changes,
            user_preferences.notification_score_changes
        ),
        notification_frequency = COALESCE(
            p_notification_frequency,
            user_preferences.notification_frequency
        ),
        updated_at = now();

    RETURN api_get_user_preferences();
END;
$function$;

COMMENT ON FUNCTION public.api_set_user_preferences(
    text,
    text,
    text[],
    boolean,
    boolean,
    boolean,
    text,
    boolean,
    text
) IS
'Create or partially update user preferences. NULL parameters preserve existing '
'values on update and resolve to defaults on insert. An explicit empty '
'p_avoid_allergens array clears the saved allergen list. A country change without '
'an explicit language retains the established country-default language behavior.';

-- Preserve the existing RPC authorization boundary explicitly.
GRANT EXECUTE ON FUNCTION public.api_set_user_preferences(
    text,
    text,
    text[],
    boolean,
    boolean,
    boolean,
    text,
    boolean,
    text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.api_set_user_preferences(
    text,
    text,
    text[],
    boolean,
    boolean,
    boolean,
    text,
    boolean,
    text
) FROM PUBLIC, anon;

COMMIT;
