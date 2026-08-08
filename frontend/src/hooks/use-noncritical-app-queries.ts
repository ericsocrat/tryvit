"use client";

import { queryKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";

const dashboardNotSettledOnServer = () => false;

/**
 * Keep dashboard-adjacent queries out of the initial `/app` critical path.
 *
 * The dashboard owns the authoritative query for this cache key. This
 * observer never fetches; it only releases noncritical work after that query
 * has settled. Other authenticated routes retain their existing immediate
 * behavior.
 */
export function useNoncriticalAppQueriesEnabled(): boolean {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const queryCache = queryClient.getQueryCache();
  const subscribe = useCallback(
    (onStoreChange: () => void) => queryCache.subscribe(onStoreChange),
    [queryCache],
  );
  const getSnapshot = useCallback(() => {
    const status = queryClient.getQueryState(queryKeys.dashboard)?.status;
    return status === "success" || status === "error";
  }, [queryClient]);
  const dashboardSettled = useSyncExternalStore(
    subscribe,
    getSnapshot,
    dashboardNotSettledOnServer,
  );

  return pathname !== "/app" || dashboardSettled;
}
