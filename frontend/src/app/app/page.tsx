"use client";

import { EmptyState } from "@/components/common/EmptyState";
import { DashboardSkeleton } from "@/components/common/skeletons/DashboardSkeleton";
import { NewUserWelcome } from "@/components/dashboard/NewUserWelcome";
import { useAnalytics } from "@/hooks/use-analytics";
import { getDashboardData } from "@/lib/api";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";

const ReturningDashboard = lazy(() =>
  import("./ReturningDashboard").then((module) => ({ default: module.ReturningDashboard })),
);

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [supabase] = useState(createClient);
  const queryClient = useQueryClient();
  const { track } = useAnalytics();
  const [displayName, setDisplayName] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => {
      const result = await getDashboardData(supabase);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.dashboard,
  });

  const hasContent = Boolean(
    data &&
    (data.recently_viewed.length > 0 ||
      data.stats.total_viewed > 0 ||
      data.stats.total_scanned > 0),
  );

  useEffect(() => {
    track("dashboard_viewed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasContent) return;

    let cancelled = false;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;

      const name = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null;
      setDisplayName(typeof name === "string" ? name : null);
    });

    return () => {
      cancelled = true;
    };
  }, [hasContent, supabase]);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  }, [queryClient]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <EmptyState
        variant="error"
        titleKey="dashboard.errorMessage"
        action={{
          labelKey: "common.tryAgain",
          onClick: () => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.dashboard,
            });
          },
        }}
      />
    );
  }

  const dashboard = data;

  if (!hasContent) {
    return <NewUserWelcome />;
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ReturningDashboard
        dashboard={dashboard}
        displayName={displayName}
        onRefresh={handleRefresh}
      />
    </Suspense>
  );
}
