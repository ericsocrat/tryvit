"use client";

// ─── Product detail page ────────────────────────────────────────────────────
// Uses the composite api_get_product_profile() endpoint for a single round-trip.

import { AlternativeProductCard } from "@/components/alternatives/AlternativeProductCard";
import { Button } from "@/components/common/Button";
import { ConfidenceBadge } from "@/components/common/ConfidenceBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { NutriScoreBadge } from "@/components/common/NutriScoreBadge";
import { PrintButton } from "@/components/common/PrintButton";
import { PullToRefresh } from "@/components/common/PullToRefresh";
import { ProductProfileSkeleton } from "@/components/common/skeletons";
import { CompareCheckbox } from "@/components/compare/CompareCheckbox";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ActionOverflowMenu } from "@/components/product/ActionOverflowMenu";
import { AddToListMenu } from "@/components/product/AddToListMenu";
import { AllergenQuickBadges } from "@/components/product/AllergenQuickBadges";
import { AvoidBadge } from "@/components/product/AvoidBadge";
import { HealthWarningsCard } from "@/components/product/HealthWarningsCard";
import { NutritionHighlights } from "@/components/product/NutritionHighlights";
import { PercentileBadge } from "@/components/product/PercentileBadge";
import { ProductHeroImage } from "@/components/product/ProductHeroImage";
import { ProductScoreHero } from "@/components/product/ProductScoreHero";
import { ShareButton } from "@/components/product/ShareButton";
import { TrafficLightStrip } from "@/components/product/TrafficLightStrip";
import { WatchButton } from "@/components/product/WatchButton";
import { CachedTimestamp } from "@/components/pwa/CachedTimestamp";
import { useAnalytics } from "@/hooks/use-analytics";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getProductProfile, recordProductView } from "@/lib/api";
import { cacheProduct, getCachedProduct } from "@/lib/cache-manager";
import { getScoreInterpretation } from "@/lib/constants";
import { eventBus } from "@/lib/events";
import { useTranslation } from "@/lib/i18n";
import { IS_QA_MODE } from "@/lib/qa-mode";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { toTryVitScore } from "@/lib/score-utils";
import { createClient } from "@/lib/supabase/client";
import type { ProductProfile } from "@/lib/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useParams } from "next/navigation";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { ProductAnalysisTab } from "./ProductFullAnalysis";

const ProductFullAnalysis = lazy(() => import("./ProductFullAnalysis"));

// ─── Progressive Disclosure Persistence ─────────────────────────────────────
const FULL_ANALYSIS_KEY = "tryvit:product-full-analysis";

function getStoredFullAnalysis(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(FULL_ANALYSIS_KEY) === "true";
}

function setStoredFullAnalysis(expanded: boolean) {
  localStorage.setItem(FULL_ANALYSIS_KEY, expanded ? "true" : "false");
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = Number(params.id);
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ProductAnalysisTab>("overview");
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const { track } = useAnalytics();
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  // Hydrate progressive disclosure preference from localStorage (SSR-safe)
  useEffect(() => {
    setShowFullAnalysis(getStoredFullAnalysis());
  }, []);

  const toggleFullAnalysis = useCallback(() => {
    setShowFullAnalysis((prev) => {
      const next = !prev;
      setStoredFullAnalysis(next);
      return next;
    });
  }, []);

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.productProfile(productId),
    queryFn: async () => {
      const result = await getProductProfile(supabase, productId);
      if (!result.ok) throw new Error(result.error.message);
      // Cache the product for offline access
      void cacheProduct(productId, result.data);
      setCachedAt(null); // Fresh data — not from cache
      return result.data;
    },
    staleTime: staleTimes.productProfile,
    enabled: !Number.isNaN(productId),
  });

  useEffect(() => {
    if (profile) {
      track("product_viewed", {
        product_id: productId,
        product_name: profile.product.product_name,
        category: profile.product.category,
      });
      void eventBus.emit({
        type: "product.viewed",
        payload: { productId, score: profile.scores.unhealthiness_score ?? 0 },
      });
      // Record view for dashboard recently-viewed section
      if (!IS_QA_MODE) {
        recordProductView(supabase, productId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // ─── Offline fallback: load from IndexedDB cache when query fails ─────────
  useEffect(() => {
    if (error && !isOnline && !profile) {
      getCachedProduct<ProductProfile>(productId).then((cached) => {
        if (cached) {
          queryClient.setQueryData(
            queryKeys.productProfile(productId),
            cached.data,
          );
          setCachedAt(cached.cachedAt);
        }
      });
    }
  }, [error, isOnline, productId, profile, queryClient]);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.productProfile(productId) });
  }, [queryClient, productId]);

  if (isLoading) {
    return <ProductProfileSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { labelKey: "nav.home", href: "/app" },
            { labelKey: "nav.search", href: "/app/search" },
          ]}
        />
        <div className="card border-error-border bg-error-bg py-8 text-center">
          <p className="mb-3 text-sm text-error-text">{t("product.loadFailed")}</p>
          <Button
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: queryKeys.productProfile(productId),
              })
            }
          >
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { labelKey: "nav.home", href: "/app" },
            { labelKey: "nav.search", href: "/app/search" },
          ]}
        />
        <EmptyState
          variant="no-results"
          titleKey="product.notFoundPage"
          descriptionKey="product.notFoundDescription"
          action={{ labelKey: "error.browseCategories", href: "/app/categories" }}
          secondaryAction={{ labelKey: "error.searchProducts", href: "/app/search" }}
        />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="space-y-4 lg:space-y-6">
      <Breadcrumbs
        items={[
          { labelKey: "nav.home", href: "/app" },
          { labelKey: "nav.search", href: "/app/search" },
          {
            label:
              profile.product.product_name_display ??
              profile.product.product_name,
          },
        ]}
      />

      {/* Desktop: 2-column grid; Mobile: single column */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6">
        {/* Left column — sticky on desktop */}
        <div className="space-y-4 lg:col-span-5 lg:space-y-6 lg:self-start lg:sticky lg:top-20">
          {/* Product Identity Card */}
          <div className="card">
            {/* Product Hero Image */}
            <div className="mb-1 sm:mb-4">
              <ProductHeroImage
                images={profile.images}
                productName={
                  profile.product.product_name_display ??
                  profile.product.product_name
                }
                categoryIcon={profile.product.category_icon}
                ean={profile.product.ean}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-lg font-bold text-foreground lg:text-xl">
                  {profile.product.product_name_display ??
                    profile.product.product_name}
                </h1>
                {profile.product.product_name_en &&
                  profile.product.product_name_display !==
                    profile.product.product_name && (
                    <p className="text-xs text-foreground-muted">
                      {t("product.originalName")}:{" "}
                      {profile.product.product_name}
                    </p>
                  )}
                <p className="text-sm text-foreground-secondary lg:text-base">
                  {profile.product.brand}
                </p>
                {cachedAt && <CachedTimestamp cachedAt={cachedAt} />}
              </div>
              <div className="no-print flex flex-wrap items-center gap-2">
                <ShareButton
                  productName={
                    profile.product.product_name_display ??
                    profile.product.product_name
                  }
                  score={profile.scores.unhealthiness_score}
                  productId={productId}
                />
                <AvoidBadge productId={productId} />
                <AddToListMenu productId={productId} />
                <CompareCheckbox
                  productId={productId}
                  productName={
                    profile.product.product_name_display ??
                    profile.product.product_name
                  }
                />
                <span className="hidden sm:contents">
                  <WatchButton productId={productId} />
                  <PrintButton />
                </span>
                <ActionOverflowMenu className="sm:hidden">
                  <WatchButton productId={productId} />
                  <PrintButton />
                </ActionOverflowMenu>
              </div>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold">
                <NutriScoreBadge
                  grade={profile.scores.nutri_score_label}
                  size="sm"
                />
                <span className="text-foreground-secondary">
                  {t("product.nutriScoreLabel")}
                </span>
              </span>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-foreground-secondary">
                {t("product.novaGroup", {
                  group: profile.scores.nova_group,
                })}
              </span>
              <PercentileBadge
                rank={profile.scores.category_context?.rank}
                total={profile.scores.category_context?.total_in_category}
              />
            </div>

            {/* Inline score hero + confidence badge */}
            <div className="mt-1 space-y-1">
              <ProductScoreHero
                variant="inline"
                unhealthinessScore={profile.scores.unhealthiness_score}
                headline={profile.scores.headline}
                hasConflicts={profile.scores.has_signal_conflicts}
              />
              {(() => {
                const q = profile.quality as Record<string, unknown> | null;
                const level = q ? (q.confidence_band as string | undefined) : undefined;
                const pct = q ? (q.confidence_score as number | undefined) : undefined;
                return level ? (
                  <ConfidenceBadge
                    level={level}
                    percentage={pct ?? undefined}
                    size="sm"
                    showLabel={false}
                    showTooltip
                  />
                ) : null;
              })()}
              <p className="text-xs text-foreground-muted">
                {t("product.scoreConfidenceHint")}
              </p>
            </div>

            {/* Health flags (inline) */}
            {(profile.flags.high_sugar ||
              profile.flags.high_salt ||
              profile.flags.high_sat_fat ||
              profile.flags.high_additive_load ||
              profile.flags.has_palm_oil) && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-foreground-muted">
                  {t("product.healthFlags")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {profile.flags.high_sugar && (
                    <FlagWithExplanation
                      label={t("product.highSugar")}
                      explanation={t("product.highSugarExplanation")}
                    />
                  )}
                  {profile.flags.high_salt && (
                    <FlagWithExplanation
                      label={t("product.highSalt")}
                      explanation={t("product.highSaltExplanation")}
                    />
                  )}
                  {profile.flags.high_sat_fat && (
                    <FlagWithExplanation
                      label={t("product.highSatFat")}
                      explanation={t("product.highSatFatExplanation")}
                    />
                  )}
                  {profile.flags.high_additive_load && (
                    <FlagWithExplanation
                      label={t("product.manyAdditives")}
                      explanation={t("product.manyAdditivesExplanation")}
                    />
                  )}
                  {profile.flags.has_palm_oil && (
                    <FlagWithExplanation
                      label={t("product.palmOil")}
                      explanation={t("product.palmOilExplanation")}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Category & EAN */}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-foreground-secondary">
              <span>
                {profile.product.category_icon}{" "}
                {profile.product.category_display}
              </span>
              {profile.product.ean && <span>EAN: {profile.product.ean}</span>}
              {profile.product.store_availability && (
                <span>Store: {profile.product.store_availability}</span>
              )}
            </div>
          </div>

          {/* Nutrition Highlights — key nutrient bars */}
          <NutritionHighlights nutrition={profile.nutrition.per_100g} />

          {/* Allergen Quick Badges */}
          <AllergenQuickBadges allergens={profile.allergens} />

          {/* Score interpretation — expandable "What does this score mean?" */}
          <ScoreInterpretationCard score={toTryVitScore(profile.scores.unhealthiness_score)} />

          {/* Personalized health warnings */}
          <ErrorBoundary
            level="section"
            context={{ section: "health-warnings", productId }}
          >
            <HealthWarningsCard productId={productId} />
          </ErrorBoundary>
        </div>

        {/* Right column — scrollable content */}
        <div className="mt-4 space-y-4 lg:col-span-7 lg:mt-0 lg:space-y-6">
          {showFullAnalysis ? (
            <ErrorBoundary
              level="section"
              context={{ section: "full-analysis", productId }}
            >
              <Suspense
                fallback={
                  <QuickSummary
                    profile={profile}
                    onExpand={toggleFullAnalysis}
                  />
                }
              >
                <ProductFullAnalysis
                  profile={profile}
                  productId={productId}
                  activeTab={activeTab}
                  onActiveTabChange={setActiveTab}
                  onCollapse={toggleFullAnalysis}
                />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <QuickSummary
              profile={profile}
              onExpand={toggleFullAnalysis}
            />
          )}
        </div>
      </div>
    </div>
    </PullToRefresh>
  );
}

// ─── Quick Summary (Progressive Disclosure) ────────────────────────────────

function QuickSummary({
  profile,
  onExpand,
}: Readonly<{
  profile: ProductProfile;
  onExpand: () => void;
}>) {
  const { t } = useTranslation();
  const interp = getScoreInterpretation(toTryVitScore(profile.scores.unhealthiness_score));
  const topAlts = profile.alternatives.slice(0, 2);

  return (
    <div className="space-y-4" data-testid="quick-summary">
      {/* Score interpretation */}
      <div className={`card ${interp.bg}`}>
        <h2 className="mb-1 text-sm font-semibold text-foreground-secondary">
          {t("product.quickSummary")}
        </h2>
        <p className={`text-sm ${interp.color}`}>{t(interp.key)}</p>
      </div>

      {/* Traffic light strip */}
      <div className="card">
        <TrafficLightStrip nutrition={profile.nutrition.per_100g} />
      </div>

      {/* Top alternatives preview */}
      {topAlts.length > 0 && (
        <div className="card" data-testid="quick-summary-alternatives">
          <h2 className="mb-2 text-sm font-semibold text-foreground-secondary">
            {t("product.topAlternatives")}
          </h2>
          <div className="space-y-3">
            {topAlts.map((alt) => (
              <AlternativeProductCard
                key={alt.product_id}
                alt={alt}
                currentScore={profile.scores.unhealthiness_score}
              />
            ))}
          </div>
          {profile.alternatives.length > 2 && (
            <button
              type="button"
              onClick={onExpand}
              className="mt-2 text-sm font-medium text-brand hover:underline"
            >
              {t("product.viewAllAlternatives")} (
              {profile.alternatives.length})
            </button>
          )}
        </div>
      )}

      {/* Expand to full analysis */}
      <Button
        fullWidth
        onClick={onExpand}
        data-testid="toggle-analysis"
      >
        <ChevronDown className="h-4 w-4" />
        {t("product.showFullAnalysis")}
      </Button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function FlagWithExplanation({
  label,
  explanation,
}: Readonly<{ label: string; explanation: string }>) {
  const [open, setOpen] = useState(false);

  return (
    <span className="group relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded bg-error-bg px-2 py-0.5 text-xs font-medium text-error-text transition-colors hover:bg-error-bg"
      >
        {label}
        <svg
          className="h-3 w-3 opacity-50"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <span className="absolute bottom-full left-0 z-10 mb-1 w-56 rounded-lg border border-border bg-surface p-2 text-xs text-foreground-secondary shadow-lg">
          {explanation}
        </span>
      )}
    </span>
  );
}

// ─── Score Interpretation Card ──────────────────────────────────────────────

function ScoreInterpretationCard({ score }: Readonly<{ score: number }>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const interp = getScoreInterpretation(score);

  return (
    <div className="card" data-testid="score-interpretation">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-semibold text-foreground-secondary lg:text-base"
        aria-expanded={open}
      >
        {t("scoreInterpretation.title")}
        <span
          className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          className={`mt-2 rounded-lg px-3 py-2 text-sm ${interp.bg} ${interp.color}`}
          data-testid="score-interpretation-content"
        >
          {t(interp.key)}
        </div>
      )}
    </div>
  );
}
