"use client";

/**
 * WatchlistPage — /app/watchlist
 * Lists all products the user is watching, with trend sparklines,
 * score deltas, and reformulation badges.
 */

import { EmptyStateIllustration } from "@/components/common/EmptyStateIllustration";
import { Icon } from "@/components/common/Icon";
import { NovaBadge } from "@/components/common/NovaBadge";
import { NutriScoreBadge } from "@/components/common/NutriScoreBadge";
import { WatchlistSkeleton } from "@/components/common/skeletons";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductRegisterCard } from "@/components/product/ProductRegisterCard";
import { ReformulationBadge } from "@/components/product/ReformulationBadge";
import { ScoreChangeIndicator } from "@/components/product/ScoreChangeIndicator";
import { ScoreTrendChart } from "@/components/product/ScoreTrendChart";
import { getWatchlist } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import type { WatchlistItem } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import styles from "./watchlist.module.css";

function WatchlistCard({ item }: Readonly<{ item: WatchlistItem }>) {
  return (
    <ProductRegisterCard
      productId={item.product_id}
      href={`/app/product/${item.product_id}`}
      name={item.product_name}
      brand={item.brand}
      category={item.category}
      score={item.current_score}
      scoreBand={item.score_band}
      variant="list"
      muted
      badges={
        <>
          <NutriScoreBadge grade={item.nutri_score} size="sm" />
          {item.nova_group ? <NovaBadge group={Number(item.nova_group)} size="sm" /> : null}
        </>
      }
      meta={
        <div className={styles.trend}>
          <ScoreChangeIndicator delta={item.last_delta} />
          <ReformulationBadge detected={item.reformulation_detected} />
          <span className={styles.chart}>
            <ScoreTrendChart history={item.sparkline} trend={item.trend} width={100} height={32} />
          </span>
        </div>
      }
    />
  );
}

export default function WatchlistPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.watchlist(page),
    queryFn: async () => {
      const result = await getWatchlist(supabase, page, 20);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.watchlist,
  });

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  return (
    <AppPage className={styles.page}>
      <Breadcrumbs
        items={[{ labelKey: "nav.home", href: "/app" }, { labelKey: "watchlist.title" }]}
      />

      <AppPageHeader
        eyebrow={t("nav.watchlist")}
        title={t("watchlist.title")}
        description={t("watchlist.subtitle")}
      />

      {isLoading ? (
        <div data-testid="watchlist-loading">
          <WatchlistSkeleton />
        </div>
      ) : null}

      {error ? (
        <div className={styles.error} role="alert" data-testid="watchlist-error">
          {t("watchlist.loadError")}
          <button type="button" className={styles.retry} onClick={() => void refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <EmptyStateIllustration
          type="no-favorites"
          titleKey="watchlist.emptyTitle"
          descriptionKey="watchlist.emptyDescription"
          action={{ labelKey: "watchlist.browseProducts", href: "/app/search" }}
        />
      ) : null}

      {items.length > 0 ? (
        <ul className={styles.items}>
          {items.map((item) => (
            <WatchlistCard key={item.watch_id} item={item} />
          ))}
        </ul>
      ) : null}

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className={styles.pagination}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={styles.pageButton}
            aria-label={t("watchlist.prevPage")}
          >
            <Icon icon={ChevronLeft} size="sm" />
          </button>
          <span className={styles.pageIndicator}>
            {t("watchlist.pageIndicator", {
              page: String(page),
              total: String(totalPages),
            })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={styles.pageButton}
            aria-label={t("watchlist.nextPage")}
          >
            <Icon icon={ChevronRight} size="sm" />
          </button>
        </div>
      ) : null}
    </AppPage>
  );
}
