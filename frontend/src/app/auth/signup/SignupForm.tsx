"use client";

import { Button, ButtonLink } from "@/components/common/Button";
import { Logo } from "@/components/common/Logo";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/common/TurnstileWidget";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import type { FormSubmitEvent } from "@/lib/types";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

interface SignupFormProps {
  readonly inviteOnly: boolean;
}

const SIGNUP_CARD_CLASS_NAME =
  "overflow-hidden rounded-3xl border border-border/70 bg-surface/95 p-6 shadow-[0_24px_72px_rgba(15,23,42,0.14)] backdrop-blur-sm sm:p-8 dark:border-white/10 dark:shadow-[0_28px_76px_rgba(0,0,0,0.38)]";

export function SignupForm({ inviteOnly }: SignupFormProps) {
  return inviteOnly ? <InviteOnlySignup /> : <SelfServiceSignupForm />;
}

function InviteOnlySignup() {
  const { t } = useTranslation();

  return (
    <div id="main-content" className="w-full max-w-md">
      <div className={SIGNUP_CARD_CLASS_NAME}>
        <div className="mb-2 flex justify-center lg:hidden">
          <Logo variant="lockup" size={36} />
        </div>

        <p className="mb-5 text-center text-xs font-medium uppercase tracking-widest text-brand lg:hidden">
          {t("landing.tagline")}
        </p>

        <h1 className="mb-3 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("auth.privateBetaTitle")}
        </h1>
        <p className="text-center text-sm text-foreground-secondary sm:text-base">
          {t("auth.privateBetaDescription")}
        </p>

        <div className="mt-7 space-y-3">
          <ButtonLink href="/auth/login" fullWidth>
            {t("auth.signIn")}
          </ButtonLink>
          <ButtonLink href="/auth/forgot-password" variant="secondary" fullWidth>
            {t("auth.forgotPassword")}
          </ButtonLink>
        </div>

        <p className="mt-6 text-center text-xs text-foreground-muted">
          {t("auth.privateBetaAccessNote")}
        </p>
      </div>
    </div>
  );
}

function SelfServiceSignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
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

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${globalThis.location.origin}/auth/callback`,
          captchaToken: turnstileToken,
        },
      });

      if (error) {
        showToast({ type: "error", message: error.message });
        return;
      }

      showToast({ type: "success", messageKey: "auth.checkEmail" });
      router.push("/auth/login?msg=check-email");
    } catch {
      showToast({ type: "error", messageKey: "auth.serviceUnavailable" });
    } finally {
      setTurnstileToken(null);
      turnstileRef.current?.reset();
      setLoading(false);
    }
  }

  return (
    <div id="main-content" className="w-full max-w-md">
      <div className={SIGNUP_CARD_CLASS_NAME}>
        <div className="mb-2 flex justify-center lg:hidden">
          <Logo variant="lockup" size={36} />
        </div>

        <p className="mb-5 text-center text-xs font-medium uppercase tracking-widest text-brand lg:hidden">
          {t("landing.tagline")}
        </p>

        <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("auth.createAccount")}
        </h1>
        <p className="mb-7 text-center text-sm text-foreground-secondary sm:text-base">
          {t("auth.signUpSubtitle")}
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
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
                autoComplete="new-password"
                required
                minLength={6}
                aria-describedby="signup-password-help"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pr-10"
                placeholder={t("auth.credentialsPlaceholder")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-foreground-muted transition-colors hover:text-foreground-secondary"
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p id="signup-password-help" className="mt-1.5 text-xs text-foreground-muted">
              {t("auth.passwordHelp")}
            </p>
          </div>

          <div className="rounded-xl border border-brand/25 bg-brand-subtle/40 p-3 shadow-[0_10px_28px_rgba(14,165,164,0.12)]">
            <TurnstileWidget
              ref={turnstileRef}
              onSuccess={handleTurnstileSuccess}
              onError={handleTurnstileError}
              onExpire={handleTurnstileExpire}
              action="signup"
              className="flex justify-center"
            />
            <p
              id="signup-captcha-hint"
              className="mt-2.5 text-center text-xs text-foreground-muted"
              aria-live="polite"
            >
              {turnstileToken ? t("auth.captchaVerified") : t("auth.captchaPrompt")}
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading || !turnstileToken}
            aria-describedby={turnstileToken ? undefined : "signup-captcha-hint"}
            className="mt-1"
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
    </div>
  );
}
