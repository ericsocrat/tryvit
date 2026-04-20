-- ═══════════════════════════════════════════════════════════════════════════
-- Revoke PUBLIC EXECUTE from privileged write/admin RPCs
-- ═══════════════════════════════════════════════════════════════════════════
-- Fixes QA Security Posture check 9 (anon blocked from non-public api_*
-- functions). The underlying bug: migrations 20260320000300 and
-- 20260321000100 re-created these functions with DROP + CREATE, which
-- resets the default ACL to GRANT EXECUTE TO PUBLIC. The subsequent
-- `REVOKE ... FROM anon` is a no-op because anon inherits from PUBLIC.
--
-- Correct pattern: revoke from PUBLIC (the Postgres default grantee) and
-- grant only to the intended roles.
--
-- Idempotent: REVOKE is a no-op if the grant is already absent.
-- ═══════════════════════════════════════════════════════════════════════════

-- api_submit_product — authenticated-only write endpoint
REVOKE EXECUTE ON FUNCTION public.api_submit_product(
    text, text, text, text, text, text, text, text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.api_submit_product(
    text, text, text, text, text, text, text, text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.api_submit_product(
    text, text, text, text, text, text, text, text
) TO authenticated;

-- api_admin_get_submissions — service_role-only admin endpoint
REVOKE EXECUTE ON FUNCTION public.api_admin_get_submissions(
    text, integer, integer, text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.api_admin_get_submissions(
    text, integer, integer, text
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.api_admin_get_submissions(
    text, integer, integer, text
) TO service_role;
