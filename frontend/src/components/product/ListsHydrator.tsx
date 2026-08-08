"use client";

// ─── ListsHydrator ──────────────────────────────────────────────────────────
// Invisible component that runs in the app layout to hydrate the Zustand
// avoid + favorites stores on login. This replaces the need for per-page
// hydration hooks. On the dashboard they begin after its primary query settles;
// other authenticated routes retain immediate hydration.

import { useAvoidProductIds, useFavoriteProductIds } from "@/hooks/use-lists";
import { useNoncriticalAppQueriesEnabled } from "@/hooks/use-noncritical-app-queries";

export function ListsHydrator() {
  const noncriticalQueriesEnabled = useNoncriticalAppQueriesEnabled();

  // These hooks fetch IDs and sync to Zustand stores via useEffect
  useAvoidProductIds(noncriticalQueriesEnabled);
  useFavoriteProductIds(noncriticalQueriesEnabled);

  return null; // Render-invisible
}
