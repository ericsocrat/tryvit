"use client";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { PullToRefresh } from "@/components/common/PullToRefresh";
import { CategoriesBrowse } from "@/components/dashboard/CategoriesBrowse";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { HealthInsightsPanel } from "@/components/dashboard/HealthInsightsPanel";
import { HealthSummary } from "@/components/dashboard/HealthSummary";
import { NutritionTip } from "@/components/dashboard/NutritionTip";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { QuickWinCard } from "@/components/dashboard/QuickWinCard";
import { RecentlyViewed } from "@/components/dashboard/RecentlyViewed";
import type { DashboardData } from "@/lib/types";

interface ReturningDashboardProps {
  dashboard: DashboardData;
  displayName: string | null;
  onRefresh: () => Promise<void>;
}

/** Dashboard sections that are not needed for the deterministic new-user path. */
export function ReturningDashboard({
  dashboard,
  displayName,
  onRefresh,
}: Readonly<ReturningDashboardProps>) {
  return (
    <PullToRefresh onRefresh={onRefresh}>
      <div className="space-y-6 lg:space-y-8">
        <div className="animate-fade-in-up">
          <DashboardGreeting displayName={displayName} />
        </div>

        {/* Health summary — average score + band distribution */}
        <div className="animate-fade-in-up" style={{ animationDelay: "50ms" }}>
          <HealthSummary products={dashboard.recently_viewed} />
        </div>

        {/* Health insights — trends, NOVA, allergens, diversity, comparisons */}
        <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <ErrorBoundary level="section" context={{ section: "health-insights" }}>
            <HealthInsightsPanel />
          </ErrorBoundary>
        </div>

        {/* Quick win — swap suggestion for worst product */}
        <div className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
          <ErrorBoundary level="section" context={{ section: "quick-win" }}>
            <QuickWinCard products={dashboard.recently_viewed} />
          </ErrorBoundary>
        </div>

        {/* Nutrition tip — daily rotating health tip */}
        <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <NutritionTip />
        </div>

        {/* Recently viewed — compact card list */}
        {dashboard.recently_viewed.length > 0 && (
          <div className="animate-fade-in-up" style={{ animationDelay: "250ms" }}>
            <ErrorBoundary level="section" context={{ section: "recently-viewed" }}>
              <RecentlyViewed products={dashboard.recently_viewed} />
            </ErrorBoundary>
          </div>
        )}

        {/* Browse categories — horizontal scrollable chips */}
        <div className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <ErrorBoundary level="section" context={{ section: "categories-browse" }}>
            <CategoriesBrowse />
          </ErrorBoundary>
        </div>

        {/* Quick actions */}
        <div className="animate-fade-in-up" style={{ animationDelay: "350ms" }}>
          <QuickActions stats={dashboard.stats} />
        </div>
      </div>
    </PullToRefresh>
  );
}
