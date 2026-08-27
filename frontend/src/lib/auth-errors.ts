export type AuthOperation = "login" | "oauth" | "recovery" | "password" | "signup";

interface AuthErrorLike {
  readonly code?: unknown;
  readonly status?: unknown;
}

const ERROR_KEYS: Readonly<Record<string, string>> = {
  captcha_failed: "auth.captchaFailed",
  current_password_required: "auth.recoverySessionRequired",
  email_not_confirmed: "auth.emailNotConfirmed",
  invalid_credentials: "auth.invalidCredentials",
  over_email_send_rate_limit: "auth.tooManyAttempts",
  over_request_rate_limit: "auth.tooManyAttempts",
  provider_disabled: "auth.providerUnavailable",
  reauthentication_needed: "auth.recoverySessionRequired",
  same_password: "auth.passwordUnchanged",
  signup_disabled: "auth.privateBetaDenied",
  weak_password: "auth.passwordTooWeak",
};

export function authErrorMessageKey(
  error: unknown,
  operation: AuthOperation,
): string {
  if (error && typeof error === "object") {
    const candidate = error as AuthErrorLike;
    if (typeof candidate.code === "string" && ERROR_KEYS[candidate.code]) {
      return ERROR_KEYS[candidate.code];
    }
    if (candidate.status === 429) return "auth.tooManyAttempts";
  }

  if (operation === "login") return "auth.invalidCredentials";
  if (operation === "oauth") return "auth.providerUnavailable";
  if (operation === "recovery") return "auth.resetEmailFailed";
  if (operation === "password") return "auth.passwordUpdateFailed";
  return operation === "signup" ? "auth.signupFailed" : "auth.serviceUnavailable";
}
