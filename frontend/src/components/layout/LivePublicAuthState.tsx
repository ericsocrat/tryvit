"use client";

import { createContext, useContext, useEffect, useState } from "react";

const LivePublicAuthContext = createContext(false);

/** One live-only auth probe shared by every public auth action on the current route. */
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
