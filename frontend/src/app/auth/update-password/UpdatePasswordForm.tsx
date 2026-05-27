"use client";

import { Button } from "@/components/common/Button";
import { Logo } from "@/components/common/Logo";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import type { FormSubmitEvent } from "@/lib/types";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdatePasswordForm() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { t } = useTranslation();

  async function handleSubmit(e: FormSubmitEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      showToast({ type: "error", messageKey: "auth.passwordMismatch" });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      showToast({ type: "error", message: error.message });
      return;
    }

    showToast({ type: "success", messageKey: "auth.passwordUpdated" });
    router.push("/auth/login?msg=password-updated");
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
          {t("auth.updatePasswordTitle")}
        </h1>
        <p className="mb-7 text-center text-sm text-foreground-secondary sm:text-base">
          {t("auth.updatePasswordSubtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="new-password"
              className="mb-1.5 block text-sm font-medium text-foreground-secondary"
            >
              {t("auth.newPassword")}
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                aria-describedby="update-password-help"
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
            <p id="update-password-help" className="mt-1 text-xs text-foreground-muted">
              {t("auth.passwordHelp")}
            </p>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-sm font-medium text-foreground-secondary"
            >
              {t("auth.confirmPassword")}
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                aria-describedby="update-password-help"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field pr-10"
                placeholder={t("auth.credentialsPlaceholder")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-foreground-muted transition-colors hover:text-foreground-secondary"
                aria-label={
                  showConfirmPassword
                    ? t("auth.hidePassword")
                    : t("auth.showPassword")
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} fullWidth>
            {loading
              ? t("auth.updatingPassword")
              : t("auth.updatePassword")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-foreground-secondary">
          <Link
            href="/auth/login"
            className="rounded-sm font-semibold text-brand underline-offset-4 transition-colors hover:text-brand-hover hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/45"
          >
            {t("auth.backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
