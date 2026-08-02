"use client";

import { Button, ButtonLink } from "@/components/common/Button";
import { Logo } from "@/components/common/Logo";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import type { FormSubmitEvent } from "@/lib/types";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { t } = useTranslation();

  async function handleSubmit(e: FormSubmitEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${globalThis.location.origin}/auth/callback?type=recovery`,
      });

      if (error) {
        showToast({ type: "error", messageKey: "auth.resetEmailFailed" });
        return;
      }

      setSent(true);
      showToast({ type: "success", messageKey: "auth.resetEmailSent" });
    } catch {
      showToast({ type: "error", messageKey: "auth.serviceUnavailable" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="main-content" className="w-full max-w-md">
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-surface/95 p-6 shadow-[0_24px_72px_rgba(15,23,42,0.14)] backdrop-blur-sm sm:p-8 dark:border-white/10 dark:shadow-[0_28px_76px_rgba(0,0,0,0.38)]">
        <div className="mb-2 flex justify-center lg:hidden">
          <Logo variant="lockup" size={36} />
        </div>
        <p className="mb-5 text-center text-xs font-medium uppercase tracking-widest text-brand lg:hidden">
          {t("landing.tagline")}
        </p>
        <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("auth.resetPasswordTitle")}
        </h1>
        <p className="mb-7 text-center text-sm text-foreground-secondary sm:text-base">
          {t("auth.resetPasswordSubtitle")}
        </p>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-success-border bg-success-bg p-4 text-sm text-success-text">
              {t("auth.resetEmailSent")}
            </div>
            <ButtonLink href="/auth/login" fullWidth>
              {t("auth.backToLogin")}
            </ButtonLink>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-foreground-secondary"
              >
                {t("auth.email")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder={t("auth.emailPlaceholder")}
              />
            </div>

            <Button type="submit" disabled={loading} fullWidth>
              {loading ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
            </Button>

            <p className="text-center text-sm text-foreground-secondary">
              <Link
                href="/auth/login"
                className="rounded-sm font-semibold text-brand underline-offset-4 transition-colors hover:text-brand-hover hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/45"
              >
                {t("auth.backToLogin")}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
