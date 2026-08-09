"use client";

import { queryKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const dashboardNotSettledOnServer = () => false;
const dashboardMissingOnServer = () => undefined;

/**
 * Keep dashboard-adjacent queries out of the initial `/app` critical path.
 *
 * The dashboard owns the authoritative query for this cache key. This
 * observer never fetches; it only releases noncritical work after that query
 * has settled and the resulting dashboard content has had a paint opportunity.
 * Other authenticated routes retain their existing immediate behavior.
 */
export function useNoncriticalAppQueriesEnabled(): boolean {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [paintedDashboardQuery, setPaintedDashboardQuery] = useState<object>();
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
  const getDashboardQuery = useCallback(
    () => queryCache.find({ queryKey: queryKeys.dashboard, exact: true }),
    [queryCache],
  );
  const dashboardQuery = useSyncExternalStore(
    subscribe,
    getDashboardQuery,
    dashboardMissingOnServer,
  );

  useEffect(() => {
    if (
      pathname !== "/app" ||
      !dashboardSettled ||
      !dashboardQuery ||
      paintedDashboardQuery === dashboardQuery
    ) {
      return;
    }

    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setPaintedDashboardQuery(dashboardQuery);
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [dashboardQuery, dashboardSettled, paintedDashboardQuery, pathname]);

  return (
    pathname !== "/app" ||
    (dashboardSettled && dashboardQuery !== undefined && paintedDashboardQuery === dashboardQuery)
  );
}
