"use client";

import {
  AuthCard,
  AuthStatus,
  PasswordField,
  authStyles,
} from "@/components/auth/AuthCard";
import { Button } from "@/components/common/Button";
import { authErrorMessageKey } from "@/lib/auth-errors";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { FormSubmitEvent } from "@/lib/types";
import { appendAuthRedirect } from "@/lib/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface UpdatePasswordFormProps {
  readonly redirect: string;
}

export function UpdatePasswordForm({ redirect }: UpdatePasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const mismatch = formErrorKey === "auth.passwordMismatch";
  const passwordFieldError = formErrorKey && !mismatch ? t(formErrorKey) : null;

  function presentError(messageKey: string) {
    setFormErrorKey(messageKey);
    setTimeout(() => errorRef.current?.focus(), 0);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();
    setFormErrorKey(null);

    if (password !== confirmPassword) {
      presentError("auth.passwordMismatch");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        presentError(authErrorMessageKey(error, "password"));
        return;
      }

      let recoverySessionClosed = false;
      try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
        recoverySessionClosed = !signOutError;
      } catch {
        recoverySessionClosed = false;
      }

      router.push(
        recoverySessionClosed
          ? appendAuthRedirect("/auth/login?msg=password-updated", redirect)
          : redirect,
      );
      router.refresh();
    } catch {
      presentError("auth.serviceUnavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow={t("auth.recoveryEyebrow")}
      title={t("auth.updatePasswordTitle")}
      description={t("auth.updatePasswordSubtitle")}
      footer={
        <Link href={appendAuthRedirect("/auth/login", redirect)} className={authStyles.link}>
          {t("auth.backToLogin")}
        </Link>
      }
    >
      {formErrorKey ? (
        <AuthStatus ref={errorRef} id="auth-password-error" kind="error">
          {t(formErrorKey)}
        </AuthStatus>
      ) : null}

      <form onSubmit={handleSubmit} className={authStyles.form}>
        <PasswordField
          id="new-password"
          name="new-password"
          label={t("auth.newPassword")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          placeholder={t("auth.passwordPlaceholder")}
          showLabel={t("auth.showPassword")}
          hideLabel={t("auth.hidePassword")}
          help={passwordFieldError ? undefined : t("auth.passwordHelp")}
          error={passwordFieldError}
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

        <Button
          type="submit"
          loading={loading}
          disabled={loading}
          fullWidth
          className={authStyles.primaryAction}
        >
          {loading ? t("auth.updatingPassword") : t("auth.updatePassword")}
        </Button>
      </form>
    </AuthCard>
  );
}
