"use client";

import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { Button } from "@/components/common/Button";
import { Logo } from "@/components/common/Logo";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import type { FormSubmitEvent } from "@/lib/types";
import { sanitizeRedirect } from "@/lib/validation";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

function classifyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate") || lower.includes("too many")) {
    return "auth.tooManyAttempts";
  }
  return "auth.invalidCredentials";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useTranslation();

  const reason = searchParams.get("reason");
  const msg = searchParams.get("msg");
  const redirect = sanitizeRedirect(searchParams.get("redirect"));
  let successBannerKey: string | null = null;
  if (msg === "check-email") {
    successBannerKey = "auth.checkEmail";
  } else if (msg === "password-updated") {
    successBannerKey = "auth.passwordUpdated";
  }

  async function handleLogin(e: FormSubmitEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      showToast({ type: "error", messageKey: classifyAuthError(error.message) });
      return;
    }

    router.push(redirect);
    router.refresh();
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
          {t("auth.welcomeBack")}
        </h1>
        <p className="mb-7 text-center text-sm text-foreground-secondary sm:text-base">
          {t("auth.signInSubtitle")}
        </p>

        {reason === "expired" && (
          <div className="mb-4 rounded-xl border border-warning-border bg-warning-bg/95 p-3 text-sm text-warning-text shadow-[0_8px_24px_rgba(245,158,11,0.14)]">
            {t("auth.sessionExpiredBanner")}
          </div>
        )}

        {successBannerKey && (
          <div
            className="mb-4 rounded-xl border border-success-border bg-success-bg/95 p-3 text-sm text-success-text shadow-[0_8px_24px_rgba(34,197,94,0.12)]"
            role="status"
            aria-live="polite"
          >
            {t(successBannerKey)}
          </div>
        )}

        <SocialLoginButtons />

        <form onSubmit={handleLogin} className="space-y-4">
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

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-foreground-secondary"
            >
              {t("auth.password")}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-describedby="login-password-help"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pr-10"
                placeholder={t("auth.credentialsPlaceholder")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-foreground-muted transition-colors hover:text-foreground-secondary"
                aria-label={
                  showPassword
                    ? t("auth.hidePassword")
                    : t("auth.showPassword")
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p id="login-password-help" className="mt-1.5 text-xs text-foreground-muted">
              {t("auth.passwordHelp")}
            </p>
            <div className="mt-2 text-right">
              <Link
                href="/auth/forgot-password"
                className="rounded-sm text-xs font-semibold text-brand underline-offset-4 transition-colors hover:text-brand-hover hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/45"
              >
                {t("auth.forgotPassword")}
              </Link>
            </div>
          </div>

          <Button type="submit" disabled={loading} fullWidth>
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-foreground-secondary">
          {t("auth.noAccount")} {" "}
          <Link
            href="/auth/signup"
            className="rounded-sm font-semibold text-brand underline-offset-4 transition-colors hover:text-brand-hover hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/45"
          >
            {t("auth.signUp")}
          </Link>
        </p>
      </div>
    </div>
  );
}
