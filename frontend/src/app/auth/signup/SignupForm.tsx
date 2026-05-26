"use client";

import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { Button } from "@/components/common/Button";
import { Logo } from "@/components/common/Logo";
import { TurnstileWidget } from "@/components/common/TurnstileWidget";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import { verifyTurnstileToken } from "@/lib/turnstile";
import type { FormSubmitEvent } from "@/lib/types";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export function SignupForm() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileError = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  async function handleSignup(e: FormSubmitEvent) {
    e.preventDefault();

    if (!turnstileToken) {
      showToast({ type: "error", messageKey: "auth.captchaRequired" });
      return;
    }

    setLoading(true);

    const verification = await verifyTurnstileToken(supabase, turnstileToken);
    if (!verification.valid) {
      setTurnstileToken(null);
      setLoading(false);
      showToast({ type: "error", messageKey: "auth.captchaFailed" });
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${globalThis.location.origin}/auth/callback`,
        captchaToken: turnstileToken,
      },
    });

    setLoading(false);

    if (error) {
      showToast({ type: "error", message: error.message });
      return;
    }

    showToast({ type: "success", messageKey: "auth.checkEmail" });
    router.push("/auth/login?msg=check-email");
  }

  return (
    <div id="main-content" className="w-full max-w-sm">
      <div className="mb-2 flex justify-center lg:hidden">
        <Logo variant="lockup" size={36} />
      </div>
      <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-brand lg:hidden">
        {t("landing.tagline")}
      </p>
      <h1 className="mb-2 text-center text-2xl font-bold text-foreground">
        {t("auth.createAccount")}
      </h1>
      <p className="mb-8 text-center text-sm text-foreground-secondary">
        {t("auth.signUpSubtitle")}
      </p>

      <SocialLoginButtons />

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-foreground-secondary"
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
            className="mb-1 block text-sm font-medium text-foreground-secondary"
          >
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={6}
              aria-describedby="signup-password-help"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field pr-10"
              placeholder={t("auth.passwordPlaceholder")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-foreground-muted hover:text-foreground-secondary"
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
          <p id="signup-password-help" className="mt-1 text-xs text-foreground-muted">
            {t("auth.passwordHelp")}
          </p>
        </div>

        <TurnstileWidget
          onSuccess={handleTurnstileSuccess}
          onError={handleTurnstileError}
          onExpire={handleTurnstileExpire}
          action="signup"
          className="flex justify-center"
        />
        <p
          id="signup-captcha-hint"
          className="text-center text-xs text-foreground-muted"
          aria-live="polite"
        >
          {turnstileToken
            ? t("auth.captchaVerified")
            : t("auth.captchaPrompt")}
        </p>

        <Button
          type="submit"
          disabled={loading || !turnstileToken}
          aria-describedby={turnstileToken ? undefined : "signup-captcha-hint"}
          fullWidth
        >
          {loading ? t("auth.creatingAccount") : t("auth.signUp")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-foreground-secondary">
        {t("auth.hasAccount")}{" "}
        <Link
          href="/auth/login"
          className="rounded-sm font-semibold text-brand underline-offset-4 transition-colors hover:text-brand-hover hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/45"
        >
          {t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}
