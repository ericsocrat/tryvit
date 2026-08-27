"use client";

import {
  AuthCard,
  AuthStatus,
  authStyles,
} from "@/components/auth/AuthCard";
import { Button, ButtonLink } from "@/components/common/Button";
import { authErrorMessageKey } from "@/lib/auth-errors";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { FormSubmitEvent } from "@/lib/types";
import { appendAuthRedirect } from "@/lib/validation";
import Link from "next/link";
import { useRef, useState } from "react";

interface ForgotPasswordFormProps {
  readonly redirect: string;
}

export function ForgotPasswordForm({ redirect }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  function presentError(messageKey: string) {
    setFormErrorKey(messageKey);
    setTimeout(() => errorRef.current?.focus(), 0);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();
    setFormErrorKey(null);
    setLoading(true);

    try {
      const callback = new URL("/auth/callback", globalThis.location.origin);
      callback.searchParams.set("type", "recovery");
      callback.searchParams.set("redirect", redirect);
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: callback.toString(),
      });

      if (error) {
        presentError(authErrorMessageKey(error, "recovery"));
        return;
      }

      setSent(true);
    } catch {
      presentError("auth.serviceUnavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow={t("auth.recoveryEyebrow")}
      title={t("auth.resetPasswordTitle")}
      description={t("auth.resetPasswordSubtitle")}
      footer={!sent ? (
        <Link href={appendAuthRedirect("/auth/login", redirect)} className={authStyles.link}>
          {t("auth.backToLogin")}
        </Link>
      ) : undefined}
    >
      {formErrorKey ? (
        <AuthStatus ref={errorRef} kind="error">
          {t(formErrorKey)}
        </AuthStatus>
      ) : null}

      {sent ? (
        <div className={authStyles.form}>
          <AuthStatus kind="success">{t("auth.resetEmailSent")}</AuthStatus>
          <ButtonLink
            href={appendAuthRedirect("/auth/login", redirect)}
            fullWidth
            className={authStyles.primaryAction}
          >
            {t("auth.backToLogin")}
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={authStyles.form}>
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

          <Button
            type="submit"
            loading={loading}
            disabled={loading}
            fullWidth
            className={authStyles.primaryAction}
          >
            {loading ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
