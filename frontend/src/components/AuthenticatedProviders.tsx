"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { shouldRetry } from "@/components/Providers";
import { initAchievementMiddleware } from "@/lib/events";
import { FlagProvider } from "@/lib/flags";
import { reportWebVitals } from "@/lib/web-vitals";

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
    reportWebVitals();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <FlagProvider>{children}</FlagProvider>
    </QueryClientProvider>
  );
}
