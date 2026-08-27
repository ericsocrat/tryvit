"use client";

import {
  AuthCard,
  AuthStatus,
  PasswordField,
  authStyles,
} from "@/components/auth/AuthCard";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { Button } from "@/components/common/Button";
import type { AuthCapabilities } from "@/lib/auth-capabilities";
import { authErrorMessageKey } from "@/lib/auth-errors";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { FormSubmitEvent } from "@/lib/types";
import { appendAuthRedirect, sanitizeAuthRedirect } from "@/lib/validation";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

interface LoginFormProps {
  readonly capabilities: AuthCapabilities;
  readonly inviteOnly?: boolean;
}

const REASON_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  expired: "auth.sessionExpiredBanner",
  "invite-only": "auth.privateBetaDenied",
  provider: "auth.providerCallbackFailed",
};

export function LoginForm({ capabilities, inviteOnly = true }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const reason = searchParams.get("reason");
  const msg = searchParams.get("msg");
  const redirect = sanitizeAuthRedirect(searchParams.get("redirect"));
  const reasonBannerKey = reason ? REASON_MESSAGE_KEYS[reason] : null;
  const successBannerKey =
    msg === "check-email"
      ? "auth.checkEmail"
      : msg === "password-updated"
        ? "auth.passwordUpdated"
        : null;
  const credentialsInvalid =
    formErrorKey === "auth.invalidCredentials" ||
    formErrorKey === "auth.emailNotConfirmed";
  const authUnavailable = capabilities.status === "unavailable";
  const renderEmailForm = capabilities.email;
  const privateBeta = inviteOnly || capabilities.signupDisabled;

  function presentError(messageKey: string) {
    setFormErrorKey(messageKey);
    setTimeout(() => errorRef.current?.focus(), 0);
  }

  async function handleLogin(event: FormSubmitEvent) {
    event.preventDefault();
    setFormErrorKey(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        presentError(authErrorMessageKey(error, "login"));
        return;
      }

      router.push(redirect);
      router.refresh();
    } catch {
      presentError("auth.serviceUnavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow={
        privateBeta
          ? t("auth.privateBetaShort")
          : t("auth.accountAccess")
      }
      title={t("auth.welcomeBack")}
      description={t("auth.signInSubtitle")}
      footer={
        privateBeta ? undefined : (
          <>
            {t("auth.noAccount")} {" "}
            <Link
              href={appendAuthRedirect("/auth/signup", redirect)}
              className={authStyles.link}
            >
              {t("auth.signUp")}
            </Link>
          </>
        )
      }
    >
      {reasonBannerKey ? (
        <AuthStatus kind="error">{t(reasonBannerKey)}</AuthStatus>
      ) : null}
      {successBannerKey ? (
        <AuthStatus kind="success">{t(successBannerKey)}</AuthStatus>
      ) : null}
      {formErrorKey ? (
        <AuthStatus ref={errorRef} id="auth-login-error" kind="error">
          {t(formErrorKey)}
        </AuthStatus>
      ) : null}

      {authUnavailable ? (
        <AuthStatus kind="info">{t("auth.providerStatusUnavailable")}</AuthStatus>
      ) : null}
      <>
          <SocialLoginButtons
            providers={authUnavailable ? [] : capabilities.providers}
            redirect={redirect}
            showEmailDivider={capabilities.email}
            onError={presentError}
          />

          {renderEmailForm ? (
            <form onSubmit={handleLogin} className={authStyles.form}>
              <div className={authStyles.field}>
                <label htmlFor="email" className={authStyles.label}>
                  {t("auth.email")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  aria-invalid={credentialsInvalid}
                  aria-describedby={credentialsInvalid ? "auth-login-error" : undefined}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={authStyles.input}
                  placeholder={t("auth.emailPlaceholder")}
                />
              </div>

              <PasswordField
                id="password"
                name="password"
                label={t("auth.password")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder={t("auth.passwordPlaceholder")}
                showLabel={t("auth.showPassword")}
                hideLabel={t("auth.hidePassword")}
                error={
                  credentialsInvalid
                    ? t(formErrorKey ?? "auth.invalidCredentials")
                    : null
                }
              />

              <div className={authStyles.inlineRow}>
                <span />
                <Link
                  href={appendAuthRedirect("/auth/forgot-password", redirect)}
                  className={authStyles.link}
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>

              <Button
                type="submit"
                loading={loading}
                disabled={loading}
                fullWidth
                className={authStyles.primaryAction}
              >
                {loading ? t("auth.signingIn") : t("auth.signIn")}
              </Button>
            </form>
          ) : capabilities.providers.length === 0 ? (
            <AuthStatus kind="info">{t("auth.noAuthMethodAvailable")}</AuthStatus>
          ) : null}

          {privateBeta ? (
            <div className={authStyles.inviteNote}>
              <strong>{t("auth.invitedAccountRequired")}</strong>
              <span>{t("auth.invitedProviderHint")}</span>
              <Link
                href={appendAuthRedirect("/auth/signup", redirect)}
                className={authStyles.link}
              >
                {t("auth.learnAboutPrivateBeta")}
              </Link>
            </div>
          ) : null}
        </>
    </AuthCard>
  );
}
