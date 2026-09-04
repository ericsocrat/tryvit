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
import { AppPage } from "@/components/layout/AppPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ActionOverflowMenu } from "@/components/product/ActionOverflowMenu";
import { AddToListMenu } from "@/components/product/AddToListMenu";
import { AllergenQuickBadges } from "@/components/product/AllergenQuickBadges";
import { AvoidBadge } from "@/components/product/AvoidBadge";
import { HealthWarningsCard } from "@/components/product/HealthWarningsCard";
import { NutritionHighlights } from "@/components/product/NutritionHighlights";
import { PercentileBadge } from "@/components/product/PercentileBadge";
import { ProductHeroImage } from "@/components/product/ProductHeroImage";
import type { ProductRegisterEvidenceState } from "@/components/product/ProductRegisterCard";
import { ProductScoreHero } from "@/components/product/ProductScoreHero";
import { ShareButton } from "@/components/product/ShareButton";
import { TrafficLightStrip } from "@/components/product/TrafficLightStrip";
import { WatchButton } from "@/components/product/WatchButton";
import { CachedTimestamp } from "@/components/pwa/CachedTimestamp";
import { ProductEvidencePanel } from "@/components/trust/ProductEvidencePanel";
import { useAnalytics } from "@/hooks/use-analytics";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  canRecommendFromProvenance,
  getProvenanceDisposition,
  useProductProvenance,
  useProductProvenanceMap,
} from "@/hooks/use-product-provenance";
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
import { ChevronDown, Info } from "lucide-react";
import { useParams } from "next/navigation";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { ProductAnalysisTab } from "./ProductFullAnalysis";

import styles from "./product-detail.module.css";

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

  const provenanceQuery = useProductProvenance(productId, !Number.isNaN(productId));
  const alternativeProvenance = useProductProvenanceMap(
    profile?.alternatives.map((alternative) => alternative.product_id) ?? [],
  );

  useEffect(() => {
    if (profile) {
      track("product_viewed", {
        product_id: productId,
        product_name: profile.product.product_name,
        category: profile.product.category,
      });
      void eventBus.emit({
        type: "product.viewed",
        payload: { productId, score: profile.scores.unhealthiness_score },
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
          queryClient.setQueryData(queryKeys.productProfile(productId), cached.data);
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
      <AppPage className={`${styles.page} ${styles.state}`}>
        <Breadcrumbs
          items={[
            { labelKey: "nav.home", href: "/app" },
            { labelKey: "nav.search", href: "/app/search" },
          ]}
        />
        <div className={styles.errorPanel}>
          <p>{t("product.loadFailed")}</p>
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
      </AppPage>
    );
  }

  if (!profile) {
    return (
      <AppPage className={`${styles.page} ${styles.state}`}>
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
      </AppPage>
    );
  }

  const provenanceDisposition = provenanceQuery.data
    ? getProvenanceDisposition(provenanceQuery.data)
    : null;
  const scoreRankingAllowed = canRecommendFromProvenance(provenanceQuery.data);
  const eligibleAlternatives = scoreRankingAllowed
    ? profile.alternatives.filter((alternative) => {
        const provenance = alternativeProvenance[alternative.product_id];
        return (
          !provenance?.isLoading &&
          !provenance?.error &&
          canRecommendFromProvenance(provenance?.data)
        );
      })
    : [];
  const recommendationsAllowed =
    scoreRankingAllowed && (profile.alternatives.length === 0 || eligibleAlternatives.length > 0);
  const recommendationProfile = {
    ...profile,
    alternatives: recommendationsAllowed ? eligibleAlternatives : profile.alternatives,
  };
  const alternativeEvidenceByProductId = Object.fromEntries(
    profile.alternatives.map((alternative) => {
      const provenance = alternativeProvenance[alternative.product_id];
      return [
        alternative.product_id,
        {
          data: provenance?.data,
          isLoading: provenance?.isLoading,
          error: provenance?.error ?? null,
        } satisfies ProductRegisterEvidenceState,
      ];
    }),
  );
  const scoreProvisional = provenanceDisposition !== "confirmed";

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <AppPage className={styles.page}>
        <Breadcrumbs
          items={[
            { labelKey: "nav.home", href: "/app" },
            { labelKey: "nav.search", href: "/app/search" },
            {
              label: profile.product.product_name_display ?? profile.product.product_name,
            },
          ]}
        />

        {/* Desktop: 2-column grid; Mobile: single column */}
        <div className={styles.contentGrid} data-testid="product-layout">
          {/* Left column — sticky on desktop */}
          <div className={styles.identityColumn} data-testid="product-identity-column">
            {/* Product Identity Card */}
            <section className={styles.identityPanel} data-testid="product-identity-panel">
              {/* Product Hero Image */}
              <div className={styles.heroMedia}>
                <ProductHeroImage
                  images={profile.images}
                  productName={profile.product.product_name_display ?? profile.product.product_name}
                  categoryIcon={profile.product.category_icon}
                  ean={profile.product.ean}
                />
              </div>

              <div className={styles.identityHeader}>
                <div className={styles.identityCopy}>
                  <p className={styles.eyebrow}>{profile.product.category_display}</p>
                  <h1 className={styles.productName}>
                    {profile.product.product_name_display ?? profile.product.product_name}
                  </h1>
                  {profile.product.product_name_en &&
                  profile.product.product_name_display !== profile.product.product_name ? (
                    <p className={styles.originalName}>
                      {t("product.originalName")}: {profile.product.product_name}
                    </p>
                  ) : null}
                  <p className={styles.brand}>{profile.product.brand}</p>
                  {cachedAt ? <CachedTimestamp cachedAt={cachedAt} /> : null}
                </div>
                <div className={`no-print ${styles.actions}`}>
                  <ShareButton
                    productName={
                      profile.product.product_name_display ?? profile.product.product_name
                    }
                    score={profile.scores.unhealthiness_score}
                    productId={productId}
                    scoreProvenanceDisposition={provenanceDisposition}
                  />
                  <AvoidBadge productId={productId} />
                  <AddToListMenu productId={productId} />
                  <CompareCheckbox
                    productId={productId}
                    productName={
                      profile.product.product_name_display ?? profile.product.product_name
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

              <div className={styles.classification}>
                <span className={styles.chip}>
                  <NutriScoreBadge grade={profile.scores.nutri_score_label} size="sm" />
                  <span>{t("product.nutriScoreLabel")}</span>
                </span>
                <span className={styles.chip}>
                  {t("product.novaGroup", {
                    group: profile.scores.nova_group,
                  })}
                </span>
                {scoreRankingAllowed ? (
                  <PercentileBadge
                    rank={profile.scores.category_context?.rank}
                    total={profile.scores.category_context?.total_in_category}
                  />
                ) : null}
              </div>

              {/* Inline score hero + confidence badge */}
              <div className={styles.scoreBlock}>
                <ProductScoreHero
                  variant="inline"
                  unhealthinessScore={profile.scores.unhealthiness_score}
                  headline={profile.scores.headline}
                  hasConflicts={profile.scores.has_signal_conflicts}
                  provisional={scoreProvisional}
                />
                {(() => {
                  const q = profile.quality as Record<string, unknown> | null;
                  const level = q ? (q.confidence_band as string | undefined) : undefined;
                  const pct = q ? (q.confidence_score as number | undefined) : undefined;
                  return level && !scoreProvisional ? (
                    <ConfidenceBadge
                      level={level}
                      percentage={pct ?? undefined}
                      size="sm"
                      showLabel={false}
                      showTooltip
                    />
                  ) : (
                    <output
                      className={styles.confidenceUnavailable}
                      data-testid="score-confidence-unavailable"
                    >
                      {t("product.confidenceUnavailable")}
                    </output>
                  );
                })()}
                {!scoreProvisional ? (
                  <p className={styles.confidenceHint}>{t("product.scoreConfidenceHint")}</p>
                ) : null}
              </div>

              {/* Health flags (inline) */}
              {profile.flags.high_sugar ||
              profile.flags.high_salt ||
              profile.flags.high_sat_fat ||
              profile.flags.high_additive_load ||
              profile.flags.has_palm_oil ? (
                <div className={styles.flags}>
                  <p className={styles.registerLabel}>{t("product.healthFlags")}</p>
                  <div className={styles.flagList}>
                    {profile.flags.high_sugar ? (
                      <FlagWithExplanation
                        label={t("product.highSugar")}
                        explanation={t("product.highSugarExplanation")}
                      />
                    ) : null}
                    {profile.flags.high_salt ? (
                      <FlagWithExplanation
                        label={t("product.highSalt")}
                        explanation={t("product.highSaltExplanation")}
                      />
                    ) : null}
                    {profile.flags.high_sat_fat ? (
                      <FlagWithExplanation
                        label={t("product.highSatFat")}
                        explanation={t("product.highSatFatExplanation")}
                      />
                    ) : null}
                    {profile.flags.high_additive_load ? (
                      <FlagWithExplanation
                        label={t("product.manyAdditives")}
                        explanation={t("product.manyAdditivesExplanation")}
                      />
                    ) : null}
                    {profile.flags.has_palm_oil ? (
                      <FlagWithExplanation
                        label={t("product.palmOil")}
                        explanation={t("product.palmOilExplanation")}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Category & EAN */}
              <div className={styles.identifiers}>
                <span className={styles.identifier}>{profile.product.category_display}</span>
                {profile.product.ean ? (
                  <span className={styles.identifier}>EAN {profile.product.ean}</span>
                ) : null}
                {profile.product.store_availability ? (
                  <span className={styles.identifier}>{profile.product.store_availability}</span>
                ) : null}
              </div>
            </section>

            {/* Nutrition Highlights — key nutrient bars */}
            <NutritionHighlights
              nutrition={profile.nutrition.per_100g}
              provisional={scoreProvisional}
            />

            {/* Allergen Quick Badges */}
            <AllergenQuickBadges allergens={profile.allergens} />

            {/* Score interpretation — expandable "What does this score mean?" */}
            <ScoreInterpretationCard
              score={toTryVitScore(profile.scores.unhealthiness_score)}
              provisional={scoreProvisional}
            />

            {/* Personalized health warnings */}
            <ErrorBoundary level="section" context={{ section: "health-warnings", productId }}>
              <HealthWarningsCard productId={productId} />
            </ErrorBoundary>
          </div>

          {/* Right column — scrollable content */}
          <div className={styles.analysisColumn} data-testid="product-analysis-column">
            <ProductEvidencePanel
              provenance={provenanceQuery.data}
              isLoading={provenanceQuery.isLoading}
              error={provenanceQuery.error}
              onRetry={() => {
                void provenanceQuery.refetch();
              }}
            />
            {showFullAnalysis ? (
              <ErrorBoundary level="section" context={{ section: "full-analysis", productId }}>
                <Suspense
                  fallback={
                    <QuickSummary
                      profile={recommendationProfile}
                      onExpand={toggleFullAnalysis}
                      recommendationsAllowed={recommendationsAllowed}
                      scoreProvisional={scoreProvisional}
                      alternativeEvidenceByProductId={alternativeEvidenceByProductId}
                    />
                  }
                >
                  <ProductFullAnalysis
                    profile={recommendationProfile}
                    productId={productId}
                    activeTab={activeTab}
                    onActiveTabChange={setActiveTab}
                    onCollapse={toggleFullAnalysis}
                    recommendationsAllowed={recommendationsAllowed}
                    scoreProvisional={scoreProvisional}
                    scoreRankingAllowed={scoreRankingAllowed}
                    alternativeEvidenceByProductId={alternativeEvidenceByProductId}
                  />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <QuickSummary
                profile={recommendationProfile}
                onExpand={toggleFullAnalysis}
                recommendationsAllowed={recommendationsAllowed}
                scoreProvisional={scoreProvisional}
                alternativeEvidenceByProductId={alternativeEvidenceByProductId}
              />
            )}
          </div>
        </div>
      </AppPage>
    </PullToRefresh>
  );
}

// ─── Quick Summary (Progressive Disclosure) ────────────────────────────────

function QuickSummary({
  profile,
  onExpand,
  recommendationsAllowed,
  scoreProvisional,
  alternativeEvidenceByProductId,
}: Readonly<{
  profile: ProductProfile;
  onExpand: () => void;
  recommendationsAllowed: boolean;
  scoreProvisional: boolean;
  alternativeEvidenceByProductId: Readonly<
    Record<number, ProductRegisterEvidenceState | undefined>
  >;
}>) {
  const { t } = useTranslation();
  const interp = getScoreInterpretation(toTryVitScore(profile.scores.unhealthiness_score));
  const topAlts = profile.alternatives.slice(0, 2);
  const hasTrafficLightEvidence = [
    profile.nutrition.per_100g.total_fat_g,
    profile.nutrition.per_100g.saturated_fat_g,
    profile.nutrition.per_100g.sugars_g,
    profile.nutrition.per_100g.salt_g,
  ].some((value) => value != null);

  return (
    <div className={styles.summary} data-testid="quick-summary">
      {/* Score interpretation */}
      <div className={styles.summaryLead}>
        <h2>{t("product.quickSummary")}</h2>
        {scoreProvisional ? (
          <p className="text-warning-text">{t("trust.evidence.scoreNoGuidance")}</p>
        ) : (
          <p className={interp.color}>{t(interp.key)}</p>
        )}
      </div>

      {/* Traffic light strip */}
      <section className={styles.registerPanel}>
        <h2 className={styles.panelTitle}>{t("product.nutrition")}</h2>
        {scoreProvisional ? (
          <p className="text-warning-text">{t("trust.evidence.nutritionGuidanceWithheld")}</p>
        ) : hasTrafficLightEvidence ? (
          <TrafficLightStrip nutrition={profile.nutrition.per_100g} />
        ) : (
          <p className="text-warning-text">{t("trust.evidence.nutritionUnavailable")}</p>
        )}
      </section>

      {/* Top alternatives preview */}
      {recommendationsAllowed && topAlts.length > 0 ? (
        <section className={styles.registerPanel} data-testid="quick-summary-alternatives">
          <h2 className={styles.panelTitle}>{t("product.topAlternatives")}</h2>
          <ul className={styles.alternatives}>
            {topAlts.map((alt) => (
              <AlternativeProductCard
                key={alt.product_id}
                alt={alt}
                currentScore={profile.scores.unhealthiness_score}
                evidence={alternativeEvidenceByProductId[alt.product_id]}
                comparisonAllowed
              />
            ))}
          </ul>
          {profile.alternatives.length > 2 ? (
            <button type="button" onClick={onExpand} className={styles.moreAlternatives}>
              {t("product.viewAllAlternatives")} ({profile.alternatives.length})
            </button>
          ) : null}
        </section>
      ) : null}

      {!recommendationsAllowed && profile.alternatives.length > 0 ? (
        <div className={styles.withheld}>{t("trust.evidence.recommendationsWithheld")}</div>
      ) : null}

      {/* Expand to full analysis */}
      <Button fullWidth onClick={onExpand} data-testid="toggle-analysis">
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
    <span className={styles.flag}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={styles.flagButton}
        aria-expanded={open}
      >
        {label}
        <Info size={13} aria-hidden="true" />
      </button>
      {open ? (
        <span className={styles.flagNote} role="note">
          {explanation}
        </span>
      ) : null}
    </span>
  );
}

// ─── Score Interpretation Card ──────────────────────────────────────────────

function ScoreInterpretationCard({
  score,
  provisional,
}: Readonly<{ score: number; provisional: boolean }>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const interp = getScoreInterpretation(score);

  return (
    <section className={styles.interpretation} data-testid="score-interpretation">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={styles.interpretationToggle}
        aria-expanded={open}
      >
        {t("scoreInterpretation.title")}
        <ChevronDown size={16} className={open ? styles.rotate : ""} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className={`${styles.interpretationContent} ${
            provisional ? "text-warning-text" : interp.color
          }`}
          data-testid="score-interpretation-content"
        >
          {t(provisional ? "trust.evidence.scoreNoGuidance" : interp.key)}
        </div>
      ) : null}
    </section>
  );
}
