"use client";

// ─── RouteGuard: centralized redirect logic for /app/* pages ────────────────
// Wraps useQuery for preferences and handles session expiry.

import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useUserPreferencesQuery } from "@/hooks/use-user-preferences-query";
import { isAuthError } from "@/lib/rpc";
import { showToast } from "@/lib/toast";
import type { UserPreferences } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: Readonly<RouteGuardProps>) {
  const router = useRouter();
  const { data, error, isPending } = useUserPreferencesQuery();

  useEffect(() => {
    if (error) {
      const code =
        error instanceof Error && "code" in error ? String(error.code) : "";
      if (isAuthError({ code, message: error.message })) {
        showToast({ type: "error", messageKey: "auth.sessionExpired" });
        // Preserve current path + querystring so login can redirect back
        const redirectTo =
          globalThis.location.pathname + globalThis.location.search;
        router.push(
          `/auth/login?reason=expired&redirect=${encodeURIComponent(redirectTo)}`,
        );
        return;
      }
      showToast({ type: "error", messageKey: "auth.preferencesFailed" });
    }
  }, [error, router]);

  useEffect(() => {
    if (data && !data.onboarding_complete) {
      router.push("/onboarding");
    }
  }, [data, router]);

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-xl border border-default bg-surface/95 p-3 shadow-[0_4px_12px_rgba(15,23,42,0.10)]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!data?.onboarding_complete) return null;

  return <>{children}</>;
}

/**
 * Hook to get the current user preferences (already cached by RouteGuard).
 */
export function usePreferences(): UserPreferences | undefined {
  const { data } = useUserPreferencesQuery();
  return data;
}
