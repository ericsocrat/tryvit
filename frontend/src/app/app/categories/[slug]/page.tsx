"use client";

// ─── Category listing — paginated product list for a single category ────────

import { AllergenChips } from "@/components/common/AllergenChips";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { NovaBadge } from "@/components/common/NovaBadge";
import { NutriScoreBadge } from "@/components/common/NutriScoreBadge";
import { PullToRefresh } from "@/components/common/PullToRefresh";
import { ProductCardSkeleton } from "@/components/common/skeletons";
import { CompareCheckbox } from "@/components/compare/CompareCheckbox";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AddToListMenu } from "@/components/product/AddToListMenu";
import { AvoidBadge } from "@/components/product/AvoidBadge";
import { HealthWarningBadge } from "@/components/product/HealthWarningsCard";
import { ProductRegisterCard } from "@/components/product/ProductRegisterCard";
import { useAnalytics } from "@/hooks/use-analytics";
import { useProductAllergenWarnings } from "@/hooks/use-product-allergens";
import type { AllergenWarning } from "@/lib/allergen-matching";
import { getCategoryListing, getCategoryOverview } from "@/lib/api";
import { eventBus } from "@/lib/events";
import { useTranslation } from "@/lib/i18n";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { toTryVitScore } from "@/lib/score-utils";
import { createClient } from "@/lib/supabase/client";
import type { CategoryOverviewItem, CategoryProduct } from "@/lib/types";
import { formatSlug } from "@/lib/validation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import styles from "@/app/app/categories/categories.module.css";

// ─── View mode ──────────────────────────────────────────────────────────────

type ViewMode = "compact" | "detailed";

const VIEW_MODE_KEY = "tryvit:category-view-mode";

function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "compact";
  const val = localStorage.getItem(VIEW_MODE_KEY);
  return val === "detailed" ? "detailed" : "compact";
}

function setStoredViewMode(mode: ViewMode) {
  localStorage.setItem(VIEW_MODE_KEY, mode);
}

const PAGE_SIZE = 20;

const SORT_OPTIONS_KEYS = [
  { value: "score", labelKey: "filters.healthScore" },
  { value: "name", labelKey: "filters.name" },
  { value: "calories", labelKey: "filters.calories" },
] as const;

export default function CategoryListingPage() {
  const params = useParams();
  const slug = String(params.slug ?? "");
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [offset, setOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("compact");
  const { track } = useAnalytics();

  // Hydrate view mode from localStorage on mount
  useEffect(() => {
    setViewMode(getStoredViewMode());
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next: ViewMode = prev === "compact" ? "detailed" : "compact";
      setStoredViewMode(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (slug) {
      track("category_viewed", { category: slug });
      void eventBus.emit({
        type: "category.viewed",
        payload: { categorySlug: slug },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.categoryListing(slug, sortBy, sortDir, offset),
    queryFn: async () => {
      const result = await getCategoryListing(supabase, {
        p_category: slug,
        p_sort_by: sortBy,
        p_sort_dir: sortDir,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.categoryListing,
  });

  // Batch-fetch allergen data for current page (#128)
  const allergenState = useProductAllergenWarnings(
    data?.products.map((p) => p.product_id) ?? [],
  );
  const allergenMap = allergenState.warnings;
  // Reuse cached category overview for summary stats
  const { data: overviewData } = useQuery({
    queryKey: queryKeys.categoryOverview,
    queryFn: async () => {
      const result = await getCategoryOverview(supabase);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.categoryOverview,
  });

  const categoryStats = overviewData?.find(
    (c: CategoryOverviewItem) => c.slug === slug,
  );

  const totalPages = data ? Math.ceil(data.total_count / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  // The listing response does not carry comparable source provenance for the
  // whole result set. Preserve score ordering as a user-selected reference,
  // but never elevate its first row into a recommendation.
  const scoreRankingWithheld = sortBy === "score" && Boolean(data?.products.length);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.categoryListing(slug, sortBy, sortDir, offset) });
  }, [queryClient, slug, sortBy, sortDir, offset]);

  // Unknown or stale category slug: the overview loaded successfully but no
  // category matches this slug. Show a dedicated not-found state instead of a
  // fabricated empty category (distinct from a valid category with 0 products).
  if (overviewData !== undefined && !categoryStats) {
    return (
      <AppPage className={styles.page}>
        <Breadcrumbs
          items={[
            { labelKey: "nav.home", href: "/app" },
            { labelKey: "categories.title", href: "/app/categories" },
            { label: formatSlug(slug) },
          ]}
        />
        <AppPageHeader
          eyebrow={t("nav.categories")}
          title={formatSlug(slug)}
        />
        <EmptyState
          variant="no-results"
          titleKey="categories.notFound"
          descriptionKey="categories.notFoundDesc"
          action={{
            labelKey: "categories.backToCategories",
            href: "/app/categories",
          }}
        />
      </AppPage>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <AppPage className={styles.page}>
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { labelKey: "nav.home", href: "/app" },
          { labelKey: "categories.title", href: "/app/categories" },
          { label: categoryStats?.display_name || formatSlug(slug) },
        ]}
      />

      <AppPageHeader
        eyebrow={t("nav.categories")}
        title={categoryStats?.display_name || formatSlug(slug)}
        description={categoryStats?.category_description ?? undefined}
        register={
          <>
            <span>{t("common.products", { count: data?.total_count ?? 0 })}</span>
            {data?.country ? (
              <span>{t("common.productFrom", { country: data.country })}</span>
            ) : null}
            <span>{t("trust.evidence.scoreProvisionalLabel")}</span>
          </>
        }
      />

      {/* Summary stats */}
      {categoryStats && <CategoryStatsCard stats={categoryStats} />}

      {/* Sort & view controls */}
      <div className={styles.listingControls}>
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setOffset(0);
          }}
          className="input-field text-sm"
        >
          {SORT_OPTIONS_KEYS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            setOffset(0);
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground-secondary hover:bg-surface-subtle"
          aria-label={t("categories.toggleSortDirection")}
        >
          {sortDir === "asc" ? t("filters.asc") : t("filters.desc")}
        </button>

        <div className={styles.viewControl}>
          <button
            onClick={toggleViewMode}
            className="rounded-lg border border-border px-3 py-2 text-sm text-foreground-secondary hover:bg-surface-subtle"
            aria-label={t("categories.toggleViewMode")}
          >
            {viewMode === "compact"
              ? t("categories.detailedView")
              : t("categories.compactView")}
          </button>
        </div>
      </div>

      {scoreRankingWithheld ? (
        <p className={styles.rankingDisclosure} role="status">
          {t("trust.evidence.comparisonUnavailable")}
        </p>
      ) : null}

      {/* Product list */}
      {isLoading ? <ProductCardSkeleton count={5} /> : null}

      {!isLoading && error && (
        <EmptyState
          variant="error"
          titleKey="categories.loadFailed"
          action={{
            labelKey: "common.retry",
            onClick: () => {
              queryClient.invalidateQueries({
                queryKey: queryKeys.categoryListing(
                  slug,
                  sortBy,
                  sortDir,
                  offset,
                ),
              });
            },
          }}
        />
      )}

      {!isLoading && !error && data?.products.length === 0 && (
        <EmptyState variant="no-data" titleKey="categories.noProducts" />
      )}

      {allergenState.enabled && allergenState.isLoading && (
        <output
          className="block rounded-lg bg-surface-subtle px-3 py-2 text-xs text-foreground-secondary"
          aria-live="polite"
          aria-busy="true"
        >
          {t("trust.evidence.allergenCheckLoading")}
        </output>
      )}

      {allergenState.enabled && allergenState.error && (
        <div
          className="rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning-text"
          role="alert"
        >
          {t("trust.evidence.allergenCheckUnavailable")} {" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={allergenState.refetch}
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {!isLoading && !error && data && data.products.length > 0 && (
        <ul className={styles.productList}>
          {data.products.map((p) => (
            <ProductRow
              key={p.product_id}
              product={p}
              allergenWarnings={allergenMap[p.product_id] ?? []}
              viewMode={viewMode}
              categorySlug={slug}
            />
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            {t("categories.previous")}
          </Button>
          <span className="text-sm text-foreground-secondary">
            {t("common.pageOf", { page: currentPage, pages: totalPages })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            {t("common.next")}
          </Button>
        </div>
      )}

      {/* Missing product CTA */}
      <p className="text-center text-xs text-foreground-tertiary pt-2">
        {t("categories.missingProduct")}{" "}
        <Link href="/app/scan/submit" className="text-brand hover:text-brand-hover font-medium">
          {t("categories.submitIt")}
        </Link>
      </p>
    </AppPage>
    </PullToRefresh>
  );
}

function ProductRow({
  product,
  allergenWarnings = [],
  viewMode = "compact",
  categorySlug,
}: Readonly<{
  product: CategoryProduct;
  allergenWarnings?: AllergenWarning[];
  viewMode?: ViewMode;
  categorySlug?: string;
}>) {
  const { t } = useTranslation();
  const detailed = viewMode === "detailed";
  const warnings = [
    product.high_sugar_flag ? t("product.highSugar") : null,
    product.high_salt_flag ? t("product.highSalt") : null,
    product.high_sat_fat_flag ? t("product.highSatFat") : null,
  ].filter((warning): warning is string => warning !== null);

  return (
    <ProductRegisterCard
      productId={product.product_id}
      href={`/app/product/${product.product_id}`}
      name={product.product_name}
      brand={product.brand}
      category={categorySlug ? formatSlug(categorySlug) : undefined}
      categorySlug={categorySlug}
      imageUrl={product.image_thumb_url}
      score={product.unhealthiness_score}
      scoreBand={product.score_band}
      variant="list"
      detail={
        product.calories == null
          ? t("trust.evidence.valueUnavailable")
          : `${product.calories} kcal`
      }
      meta={
        <>
          {detailed
            ? warnings.map((warning) => (
                <span className={styles.warning} key={warning}>
                  {warning}
                </span>
              ))
            : null}
          <AllergenChips warnings={allergenWarnings} />
        </>
      }
      badges={
        <>
          <NutriScoreBadge grade={product.nutri_score} size="sm" />
          {product.nova_group ? (
            <NovaBadge group={Number(product.nova_group)} size="sm" />
          ) : null}
        </>
      }
      actions={
        detailed ? (
          <>
            <HealthWarningBadge productId={product.product_id} />
            <AvoidBadge productId={product.product_id} />
            <AddToListMenu productId={product.product_id} compact />
            <CompareCheckbox
              productId={product.product_id}
              productName={product.product_name}
            />
          </>
        ) : undefined
      }
    />
  );
}

/* ── Category Summary Stats Card ──────────────────────────────────────────── */

function CategoryStatsCard({
  stats,
}: Readonly<{ stats: CategoryOverviewItem }>) {
  const { t } = useTranslation();

  return (
    <section aria-label={t("categories.title")}>
      <dl className={styles.statsRegister}>
        <div className={styles.stat}>
          <dt>{t("categories.statAvgScore")}</dt>
          <dd>{toTryVitScore(Math.round(stats.avg_score))}</dd>
        </div>
        <div className={styles.stat}>
          <dt>{t("categories.scoreRange")}</dt>
          <dd>
            {toTryVitScore(stats.max_score)}–{toTryVitScore(stats.min_score)}
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>{t("categories.nutriAB")}</dt>
          <dd>{Math.round(stats.pct_nutri_a_b)}%</dd>
        </div>
        <div className={styles.stat}>
          <dt>{t("categories.nova4Pct")}</dt>
          <dd>{Math.round(stats.pct_nova_4)}%</dd>
        </div>
      </dl>
      <p className={styles.statsDisclosure}>
        {t("trust.evidence.scoreNoGuidance")}
      </p>
    </section>
  );
}
