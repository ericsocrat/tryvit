import { describe, expect, it } from "vitest";
import { authErrorMessageKey } from "./auth-errors";

describe("authErrorMessageKey", () => {
  it.each([
    ["invalid_credentials", "auth.invalidCredentials"],
    ["email_not_confirmed", "auth.emailNotConfirmed"],
    ["signup_disabled", "auth.privateBetaDenied"],
    ["provider_disabled", "auth.providerUnavailable"],
    ["weak_password", "auth.passwordTooWeak"],
    ["same_password", "auth.passwordUnchanged"],
    ["captcha_failed", "auth.captchaFailed"],
    ["current_password_required", "auth.recoverySessionRequired"],
    ["reauthentication_needed", "auth.recoverySessionRequired"],
  ])("maps %s without exposing backend text", (code, expected) => {
    expect(authErrorMessageKey({ code, message: "raw backend text" }, "login")).toBe(
      expected,
    );
  });

  it("maps HTTP 429 independently of localized backend text", () => {
    expect(authErrorMessageKey({ status: 429 }, "recovery")).toBe(
      "auth.tooManyAttempts",
    );
  });

  it("uses operation-safe fallbacks", () => {
    expect(authErrorMessageKey(new Error("unknown"), "login")).toBe(
      "auth.invalidCredentials",
    );
    expect(authErrorMessageKey(new Error("unknown"), "password")).toBe(
      "auth.passwordUpdateFailed",
    );
  });
});
