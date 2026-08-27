"use client";

import {
  AuthCard,
  AuthStatus,
  PasswordField,
  authStyles,
} from "@/components/auth/AuthCard";
import { Button, ButtonLink } from "@/components/common/Button";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/common/TurnstileWidget";
import { authErrorMessageKey } from "@/lib/auth-errors";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { FormSubmitEvent } from "@/lib/types";
import { appendAuthRedirect } from "@/lib/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

interface SignupFormProps {
  readonly inviteOnly: boolean;
  readonly redirect: string;
}

export function SignupForm({ inviteOnly, redirect }: SignupFormProps) {
  return inviteOnly ? (
    <InviteOnlySignup redirect={redirect} />
  ) : (
    <SelfServiceSignupForm redirect={redirect} />
  );
}

function InviteOnlySignup({ redirect }: { readonly redirect: string }) {
  const { t } = useTranslation();

  return (
    <AuthCard
      eyebrow={t("auth.privateBetaShort")}
      title={t("auth.privateBetaTitle")}
      description={t("auth.privateBetaDescription")}
      footer={t("auth.privateBetaAccessNote")}
    >
      <div className={authStyles.form}>
        <AuthStatus kind="info">{t("auth.invitedAccountRequired")}</AuthStatus>
        <ButtonLink
          href={appendAuthRedirect("/auth/login", redirect)}
          fullWidth
          className={authStyles.primaryAction}
        >
          {t("auth.signInContinue")}
        </ButtonLink>
        <ButtonLink
          href={appendAuthRedirect("/auth/forgot-password", redirect)}
          variant="secondary"
          fullWidth
          className={authStyles.secondaryAction}
        >
          {t("auth.recoverInvitedAccount")}
        </ButtonLink>
      </div>
    </AuthCard>
  );
}

function SelfServiceSignupForm({ redirect }: { readonly redirect: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const { t } = useTranslation();

  const mismatch = formErrorKey === "auth.passwordMismatch";

  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const clearTurnstile = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  function presentError(messageKey: string) {
    setFormErrorKey(messageKey);
    setTimeout(() => errorRef.current?.focus(), 0);
  }

  async function handleSignup(event: FormSubmitEvent) {
    event.preventDefault();
    setFormErrorKey(null);

    if (password !== confirmPassword) {
      presentError("auth.passwordMismatch");
      return;
    }
    if (!turnstileToken) {
      presentError("auth.captchaRequired");
      return;
    }

    setLoading(true);

    try {
      const callback = new URL("/auth/callback", globalThis.location.origin);
      callback.searchParams.set("redirect", redirect);
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: callback.toString(),
          captchaToken: turnstileToken,
        },
      });

      if (error) {
        presentError(authErrorMessageKey(error, "signup"));
        return;
      }

      router.push(appendAuthRedirect("/auth/login?msg=check-email", redirect));
      router.refresh();
    } catch {
      presentError("auth.serviceUnavailable");
    } finally {
      clearTurnstile();
      turnstileRef.current?.reset();
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow={t("auth.accountAccess")}
      title={t("auth.createAccount")}
      description={t("auth.signUpSubtitle")}
      footer={
        <>
          {t("auth.hasAccount")} {" "}
          <Link href={appendAuthRedirect("/auth/login", redirect)} className={authStyles.link}>
            {t("auth.signIn")}
          </Link>
        </>
      }
    >
      {formErrorKey ? (
        <AuthStatus ref={errorRef} kind="error">
          {t(formErrorKey)}
        </AuthStatus>
      ) : null}

      <form onSubmit={handleSignup} className={authStyles.form}>
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
          autoComplete="new-password"
          placeholder={t("auth.passwordPlaceholder")}
          showLabel={t("auth.showPassword")}
          hideLabel={t("auth.hidePassword")}
          help={t("auth.passwordHelp")}
          minLength={6}
        />

        <PasswordField
          id="confirm-password"
          name="confirm-password"
          label={t("auth.confirmPassword")}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          placeholder={t("auth.passwordPlaceholder")}
          showLabel={t("auth.showPassword")}
          hideLabel={t("auth.hidePassword")}
          error={mismatch ? t("auth.passwordMismatch") : null}
          minLength={6}
        />

        <div className={authStyles.captchaPanel}>
          <TurnstileWidget
            ref={turnstileRef}
            onSuccess={handleTurnstileSuccess}
            onError={clearTurnstile}
            onExpire={clearTurnstile}
            action="signup"
            size="compact"
            className="flex justify-center"
          />
          <p id="signup-captcha-hint" className={authStyles.captchaHint} aria-live="polite">
            {turnstileToken ? t("auth.captchaVerified") : t("auth.captchaPrompt")}
          </p>
        </div>

        <Button
          type="submit"
          loading={loading}
          disabled={loading || !turnstileToken}
          aria-describedby={turnstileToken ? undefined : "signup-captcha-hint"}
          fullWidth
          className={authStyles.primaryAction}
        >
          {loading ? t("auth.creatingAccount") : t("auth.signUp")}
        </Button>
      </form>
    </AuthCard>
  );
}
