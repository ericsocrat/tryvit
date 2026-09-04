"use client";

import { DashboardSkeleton } from "@/components/common/skeletons/DashboardSkeleton";
import { NewUserWelcome } from "@/components/dashboard/NewUserWelcome";
import { DashboardHeader, DashboardStart } from "@/components/dashboard/DashboardWorkspace";
import styles from "@/components/dashboard/DashboardWorkspace.module.css";
import { useAnalytics } from "@/hooks/use-analytics";
import { getDashboardData } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

const ReturningDashboard = lazy(() =>
  import("./ReturningDashboard").then((module) => ({ default: module.ReturningDashboard })),
);

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [supabase] = useState(createClient);
  const queryClient = useQueryClient();
  const { track } = useAnalytics();
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState<string | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
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
      data.stats.total_scanned > 0 ||
      data.favorites_preview.length > 0 ||
      data.stats.favorites_count > 0 ||
      // Onboarding creates two empty system lists: Favorites and Avoid.
      data.stats.lists_count > 2),
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
    }).catch(() => {
      // The display name is optional; a failed identity refresh must not hide history.
    });

    return () => {
      cancelled = true;
    };
  }, [hasContent, supabase]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardInsights }),
    ]);
  }, [queryClient]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className={styles.workspace}>
        <DashboardHeader />
        <section className={styles.error} data-testid="dashboard-error" aria-labelledby="dashboard-error-title">
          <AlertCircle size={24} aria-hidden="true" />
          <div>
            <div role="alert"><h2 id="dashboard-error-title">{t("dashboard.home.errorTitle")}</h2><p>{t("dashboard.home.errorDescription")}</p></div>
            <button type="button" className={styles.retry} onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw size={16} aria-hidden="true" />{t(isFetching ? "common.loading" : "dashboard.home.retry")}
            </button>
          </div>
        </section>
        <DashboardStart />
      </div>
    );
  }

  const dashboard = data;
  const refreshNotice = isError ? (
    <div className={`${styles.workspace} ${styles.sectionMessage}`} role="alert">
      <p>{t("dashboard.home.staleError")}</p>
      <button type="button" className={styles.retry} onClick={() => void refetch()} disabled={isFetching}>{t(isFetching ? "common.loading" : "dashboard.home.retry")}</button>
    </div>
  ) : null;

  if (!hasContent) {
    return <>{refreshNotice}<NewUserWelcome /></>;
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      {refreshNotice}
      <ReturningDashboard
        dashboard={dashboard}
        displayName={displayName}
        onRefresh={handleRefresh}
      />
    </Suspense>
  );
}
