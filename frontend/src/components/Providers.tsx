"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { RouteAnnouncer } from "@/components/common/RouteAnnouncer";
import { LanguageSynchronizer } from "@/components/i18n/LanguageSynchronizer";
import {
  InitialLanguageContext,
  type InitialLanguage,
} from "@/lib/initial-language-context";

/** Don't retry on 4xx auth or PostgREST JWT errors; retry up to 2× otherwise */
export function shouldRetry(failureCount: number, error: Error): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (["401", "403", "PGRST301"].includes(code)) return false;
  }
  return failureCount < 2;
}

export function Providers({
  children,
  initialLanguage,
}: Readonly<{
  children: ReactNode;
  initialLanguage: InitialLanguage;
}>) {
  return (
    <InitialLanguageContext.Provider value={initialLanguage}>
      <LanguageSynchronizer initialLanguage={initialLanguage} />
      <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={100}>
        {children}
      </TooltipPrimitive.Provider>
      <RouteAnnouncer />
      <Toaster
        position="top-right"
        richColors
        closeButton
        visibleToasts={3}
        toastOptions={{
          duration: 5000,
        }}
      />
    </InitialLanguageContext.Provider>
  );
}
