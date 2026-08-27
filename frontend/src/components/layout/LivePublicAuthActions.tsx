"use client";

import { ButtonLink } from "@/components/common/Button";
import { ChevronRight } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";

const LivePublicAuthContext = createContext(false);

/** One live-only auth probe shared by every landing auth action. */
export function LivePublicAuthProvider({ children }: { readonly children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void import("@/lib/supabase/client")
      .then(({ createClient }) => {
        if (!active) return;
        const client = createClient();
        void client.auth
          .getUser()
          .then(({ data }) => {
            if (active) setIsAuthenticated(Boolean(data.user));
          })
          .catch(() => undefined);

        const listener = client.auth.onAuthStateChange?.((_event, session) => {
          if (active) setIsAuthenticated(Boolean(session?.user));
        });
        unsubscribe = () => listener?.data.subscription.unsubscribe();
      })
      .catch(() => undefined);

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return (
    <LivePublicAuthContext.Provider value={isAuthenticated}>
      {children}
    </LivePublicAuthContext.Provider>
  );
}

export function useLivePublicAuth(): boolean {
  return useContext(LivePublicAuthContext);
}

export function LiveHeaderAuthAction({
  signInLabel,
  dashboardLabel,
}: {
  readonly signInLabel: string;
  readonly dashboardLabel: string;
}) {
  const isAuthenticated = useLivePublicAuth();

  return (
    <ButtonLink href={isAuthenticated ? "/app" : "/auth/login"} prefetch={false}>
      {isAuthenticated ? dashboardLabel : signInLabel}
    </ButtonLink>
  );
}

export function LiveLandingAuthActions({
  placement,
  getStartedLabel,
  signInLabel,
  dashboardLabel,
}: {
  readonly placement: "hero" | "closing";
  readonly getStartedLabel: string;
  readonly signInLabel: string;
  readonly dashboardLabel: string;
}) {
  const isAuthenticated = useLivePublicAuth();
  const padding = placement === "hero" ? "px-8" : "px-10";

  if (isAuthenticated) {
    return (
      <ButtonLink
        href="/app"
        size="lg"
        className={`w-full ${padding} sm:w-auto`}
        iconRight={<ChevronRight size={18} aria-hidden="true" />}
      >
        {dashboardLabel}
      </ButtonLink>
    );
  }

  return (
    <>
      <ButtonLink
        href="/auth/signup"
        size="lg"
        className={`w-full ${padding} sm:w-auto`}
        iconRight={<ChevronRight size={18} aria-hidden="true" />}
      >
        {getStartedLabel}
      </ButtonLink>
      <ButtonLink
        href="/auth/login"
        variant="secondary"
        size="lg"
        className={`w-full ${padding} sm:w-auto`}
      >
        {signInLabel}
      </ButtonLink>
    </>
  );
}
