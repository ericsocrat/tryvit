"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { shouldRetry } from "@/components/Providers";
import { initAchievementMiddleware } from "@/lib/events";
import { FlagProvider } from "@/lib/flags";

/** Backend-dependent providers mounted exclusively inside authenticated `/app`. */
export function AuthenticatedProviders({ children }: Readonly<{ children: ReactNode }>) {
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

  useEffect(() => initAchievementMiddleware(), []);

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
      <FlagProvider>{children}</FlagProvider>
    </QueryClientProvider>
  );
}
