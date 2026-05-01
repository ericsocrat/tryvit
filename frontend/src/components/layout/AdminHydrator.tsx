"use client";

// ─── AdminHydrator ──────────────────────────────────────────────────────────
// Invisible component rendered in the server layout to hydrate the Zustand
// admin store. Admin status is computed server-side from ADMIN_EMAILS env var,
// then passed as a prop — the email list is never exposed to the client.

import { useAdminStore } from "@/stores/admin-store";
import { useEffect } from "react";

export function AdminHydrator({ isAdmin }: Readonly<{ isAdmin: boolean }>) {
  const setIsAdmin = useAdminStore((s) => s.setIsAdmin);

  // Hydrate on mount and re-sync if prop changes (e.g. session refresh).
  // The store is consumed by client components that already gate on hydration
  // via Zustand's persist middleware, so a one-frame delay is acceptable.
  useEffect(() => {
    setIsAdmin(isAdmin);
  }, [isAdmin, setIsAdmin]);

  return null;
}
