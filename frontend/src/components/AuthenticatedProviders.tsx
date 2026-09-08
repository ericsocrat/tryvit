"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { shouldRetry } from "@/components/Providers";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { initAchievementMiddleware } from "@/lib/events";
import { clearPrivateClientState } from "@/lib/private-client-state";
import { createClient } from "@/lib/supabase/client";

type AuthenticatedProviderProps = Readonly<{ userId: string; children: ReactNode }>;

/** Backend-dependent providers mounted exclusively inside authenticated `/app`. */
export function AuthenticatedProviders({ userId, children }: AuthenticatedProviderProps) {
  return <AccountProviders key={userId} userId={userId}>{children}</AccountProviders>;
}

function AccountProviders({ userId, children }: AuthenticatedProviderProps) {
  const router = useRouter();
  const privateContainer = useRef<HTMLDivElement>(null);
  const [identityConsistent, setIdentityConsistent] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: shouldRetry,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    let disposed = false;
    let admitted = false;
    let revoked = false;
    let navigation: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
      if (disposed) return;
      const observedId = event === "SIGNED_OUT" ? null : session?.user.id ?? null;
      if (!revoked && observedId === userId) {
        if (!admitted) {
          clearPrivateClientState(queryClient);
          admitted = true;
          setIdentityConsistent(true);
        }
        return; // Same-user refreshes keep their cache and private state.
      }

      revoked = true;
      // Conceal immediately, before React's scheduled commit or any async work.
      if (privateContainer.current) privateContainer.current.style.display = "none";
      setIdentityConsistent(false);
      clearPrivateClientState(queryClient);
      if (navigation) clearTimeout(navigation);
      navigation = setTimeout(() => {
        if (disposed) return;
        if (!observedId || observedId === userId) router.replace("/auth/login");
        else router.refresh(); // Only the refreshed server getUser gate may admit B.
      }, 0);
    });
    return () => {
      disposed = true;
      if (navigation) clearTimeout(navigation);
      subscription.unsubscribe();
      clearPrivateClientState(queryClient);
    };
  }, [queryClient, router, userId]);

  useEffect(() => {
    if (identityConsistent) return initAchievementMiddleware();
  }, [identityConsistent]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

    let cancelled = false;
    void import("@/lib/web-vitals")
      .then(({ reportWebVitals }) => {
        if (!cancelled) reportWebVitals();
      })
      .catch(() => {
        // Optional performance telemetry must not affect the application.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {identityConsistent ? (
        <div ref={privateContainer} style={{ display: "contents" }}>{children}</div>
      ) : (
        <div className="flex min-h-[50vh] items-center justify-center"><LoadingSpinner /></div>
      )}
    </QueryClientProvider>
  );
}
