"use client";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { PullToRefresh } from "@/components/common/PullToRefresh";
import { DashboardCollections } from "@/components/dashboard/DashboardCollections";
import { DashboardAllergenNotice } from "@/components/dashboard/DashboardAllergenNotice";
import { DashboardHeader, DashboardStart } from "@/components/dashboard/DashboardWorkspace";
import { RecentlyViewed } from "@/components/dashboard/RecentlyViewed";
import styles from "@/components/dashboard/DashboardWorkspace.module.css";
import type { HomeReadModel } from "@/lib/evidence/home";

interface ReturningDashboardProps {
  dashboard: HomeReadModel;
  displayName: string | null;
  onRefresh: () => Promise<void>;
  stale?: boolean;
  refreshing?: boolean;
}

export function ReturningDashboard({ dashboard, displayName, onRefresh, stale = false, refreshing = false }: Readonly<ReturningDashboardProps>) {
  return (
    <PullToRefresh onRefresh={onRefresh}>
      <div className={styles.workspace} data-testid="returning-dashboard">
        <DashboardHeader displayName={displayName} />
        <DashboardStart />
        <ErrorBoundary level="section" context={{ section: "allergen-notice" }}><DashboardAllergenNotice matches={dashboard.saved_allergen_matches} stale={stale} refreshing={refreshing} /></ErrorBoundary>
        <div className={styles.columns}>
          <ErrorBoundary level="section" context={{ section: "recently-viewed" }}><RecentlyViewed products={dashboard.recently_viewed} /></ErrorBoundary>
          <ErrorBoundary level="section" context={{ section: "collections" }}><DashboardCollections favorites={dashboard.favorites_preview} stats={dashboard.stats} /></ErrorBoundary>
        </div>
      </div>
    </PullToRefresh>
  );
}
