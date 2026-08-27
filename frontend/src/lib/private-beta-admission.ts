/**
 * Server-owned private-beta presentation boundary.
 *
 * The hosted Supabase Auth `disable_signup` setting remains the authoritative
 * account-creation boundary. This helper fails closed so missing or malformed
 * frontend deployment configuration cannot expose the self-service form.
 */
export function isPrivateBetaInviteOnly(
  value = process.env.TRYVIT_PRIVATE_BETA_INVITE_ONLY,
): boolean {
  return value?.trim().toLowerCase() !== "false";
}

/**
 * A separate explicit operator seal is required before the dormant signup UI
 * may trust Supabase Auth to consume CAPTCHA tokens. Hosted Auth does not expose
 * this setting through its public capabilities endpoint.
 */
export function isNativeSignupCaptchaEnabled(
  value = process.env.TRYVIT_SUPABASE_NATIVE_CAPTCHA_ENABLED,
): boolean {
  return value?.trim().toLowerCase() === "true";
}
