"use client";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { PullToRefresh } from "@/components/common/PullToRefresh";
import { CategoriesBrowse } from "@/components/dashboard/CategoriesBrowse";
import { DashboardCollections } from "@/components/dashboard/DashboardCollections";
import { DashboardAllergenNotice } from "@/components/dashboard/DashboardAllergenNotice";
import { DashboardGuide, DashboardHeader, DashboardStart } from "@/components/dashboard/DashboardWorkspace";
import { RecentlyViewed } from "@/components/dashboard/RecentlyViewed";
import styles from "@/components/dashboard/DashboardWorkspace.module.css";
import type { DashboardData } from "@/lib/types";

interface ReturningDashboardProps {
  dashboard: DashboardData;
  displayName: string | null;
  onRefresh: () => Promise<void>;
}

export function ReturningDashboard({ dashboard, displayName, onRefresh }: Readonly<ReturningDashboardProps>) {
  return (
    <PullToRefresh onRefresh={onRefresh}>
      <div className={styles.workspace} data-testid="returning-dashboard">
        <DashboardHeader displayName={displayName} />
        <DashboardStart />
        <ErrorBoundary level="section" context={{ section: "allergen-notice" }}><DashboardAllergenNotice /></ErrorBoundary>
        <div className={styles.columns}>
          <ErrorBoundary level="section" context={{ section: "recently-viewed" }}><RecentlyViewed products={dashboard.recently_viewed} /></ErrorBoundary>
          <ErrorBoundary level="section" context={{ section: "collections" }}><DashboardCollections favorites={dashboard.favorites_preview} stats={dashboard.stats} /></ErrorBoundary>
        </div>
        <ErrorBoundary level="section" context={{ section: "categories-browse" }}><CategoriesBrowse /></ErrorBoundary>
        <DashboardGuide />
      </div>
    </PullToRefresh>
  );
}
