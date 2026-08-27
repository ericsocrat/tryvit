"use client";

import type { SocialAuthProvider } from "@/lib/auth-capabilities";
import { authErrorMessageKey } from "@/lib/auth-errors";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import styles from "./AuthExperience.module.css";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

interface SocialLoginButtonsProps {
  readonly providers: readonly SocialAuthProvider[];
  readonly redirect: string;
  readonly showEmailDivider?: boolean;
  readonly onError: (messageKey: string) => void;
}

export function SocialLoginButtons({
  providers,
  redirect,
  showEmailDivider = true,
  onError,
}: SocialLoginButtonsProps) {
  const { t } = useTranslation();
  const [loadingProvider, setLoadingProvider] = useState<SocialAuthProvider | null>(null);

  if (providers.length === 0) return null;

  async function handleSocialLogin(provider: SocialAuthProvider) {
    setLoadingProvider(provider);

    try {
      const callback = new URL("/auth/callback", globalThis.location.origin);
      callback.searchParams.set("redirect", redirect);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callback.toString() },
      });

      if (!error) return;
      onError(authErrorMessageKey(error, "oauth"));
    } catch (error) {
      onError(authErrorMessageKey(error, "oauth"));
    }

    setLoadingProvider(null);
  }

  return (
    <div>
      <div className={styles.socialStack}>
        {providers.includes("google") ? (
          <button
            type="button"
            disabled={loadingProvider !== null}
            aria-busy={loadingProvider === "google" || undefined}
            onClick={() => handleSocialLogin("google")}
            className={styles.socialButton}
          >
            <GoogleIcon />
            {loadingProvider === "google"
              ? t("auth.redirecting")
              : t("auth.continueWithGoogle")}
          </button>
        ) : null}

      </div>

      <p className={styles.socialHint}>{t("auth.socialInviteMatchHint")}</p>

      {showEmailDivider ? (
        <div className={styles.divider}>{t("auth.orContinueWithEmail")}</div>
      ) : null}
    </div>
  );
}
