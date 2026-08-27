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
