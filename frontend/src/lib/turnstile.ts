// ─── Turnstile CAPTCHA Client Utilities ─────────────────────────────────────
// Client-side helpers for Cloudflare Turnstile integration.
// Uses @marsidev/react-turnstile for the widget and Supabase Edge Function
// for server-side token verification.
//
// Test keys (CI / local development):
//   Site key:   1x00000000000000000000AA (always passes)
//   Secret key: 1x0000000000000000000000000000000AA (always passes)
//
// Issue: #470
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Cloudflare Turnstile test site key — always passes verification.
 * Used when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured.
 */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

/**
 * Edge Function name for server-side verification.
 */
export const VERIFY_FUNCTION_NAME = "verify-turnstile";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TurnstileVerifySuccess {
  valid: true;
  challenge_ts?: string;
  hostname?: string;
}

export interface TurnstileVerifyFailure {
  valid: false;
  error: string;
  error_codes?: string[];
}

export type TurnstileVerifyResult =
  | TurnstileVerifySuccess
  | TurnstileVerifyFailure;

// ─── Configuration ──────────────────────────────────────────────────────────

/**
 * Returns the configured Turnstile site key, falling back to the test key
 * for local development when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set.
 */
export function getTurnstileSiteKey(): string {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return key || TURNSTILE_TEST_SITE_KEY;
}

/**
 * Returns true if Turnstile is configured with a real (non-test) site key.
 */
export function isTurnstileConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return !!key && key !== TURNSTILE_TEST_SITE_KEY;
}

// ─── Server-Side Verification ───────────────────────────────────────────────

/**
 * Verify a Turnstile token via the Edge Function.
 * Verification fails closed when the function is unavailable, returns an
 * unexpected payload, or rejects the token.
 */
export async function verifyTurnstileToken(
  supabase: SupabaseClient,
  token: string,
): Promise<TurnstileVerifyResult> {
  if (!token || token.trim().length === 0) {
    return { valid: false, error: "Missing Turnstile token." };
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      VERIFY_FUNCTION_NAME,
      { body: { token } },
    );

    if (error) {
      console.warn("Turnstile verification unavailable:", error.message);
      return { valid: false, error: "Turnstile verification unavailable." };
    }

    if (data && typeof data === "object" && "valid" in data) {
      return data as TurnstileVerifyResult;
    }

    console.warn("Unexpected Turnstile response:", data);
    return { valid: false, error: "Unexpected Turnstile verification response." };
  } catch {
    console.warn("Turnstile verification network error");
    return { valid: false, error: "Turnstile verification unavailable." };
  }
}

// ─── Type Guards ────────────────────────────────────────────────────────────

export function isTurnstileSuccess(
  result: TurnstileVerifyResult,
): result is TurnstileVerifySuccess {
  return result.valid;
}

export function isTurnstileFailure(
  result: TurnstileVerifyResult,
): result is TurnstileVerifyFailure {
  return !result.valid;
}
