"use client";

import { AlternativesSection } from "@/components/alternatives/AlternativesSection";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AllergenMatrix } from "@/components/product/AllergenMatrix";
import { DVLegend } from "@/components/product/DVLegend";
import { DVReferenceBadge } from "@/components/product/DVReferenceBadge";
import { IngredientList } from "@/components/product/IngredientList";
import { NovaIndicator } from "@/components/product/NovaIndicator";
import { NutritionDVBar } from "@/components/product/NutritionDVBar";
import { PercentileBadge } from "@/components/product/PercentileBadge";
import { ProductImageTabs } from "@/components/product/ProductImageTabs";
import { ScoreBreakdownPanel } from "@/components/product/ScoreBreakdownPanel";
import { ScoreHistoryPanel } from "@/components/product/ScoreHistoryPanel";
import { ScoreRadarChart } from "@/components/product/ScoreRadarChart";
import { getTrafficLight } from "@/components/product/TrafficLightChip";
import { TrafficLightStrip } from "@/components/product/TrafficLightStrip";
import { FEATURES, SCORE_BANDS } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { toTryVitScore } from "@/lib/score-utils";
import type { DataConfidence, ProductProfile } from "@/lib/types";
import { ChevronUp, Globe, Info } from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  type TouchEvent,
  useCallback,
  useRef,
  useState,
} from "react";

export type ProductAnalysisTab = "overview" | "nutrition" | "alternatives" | "scoring";

const TAB_ORDER: ProductAnalysisTab[] = ["overview", "nutrition", "alternatives", "scoring"];
const SWIPE_THRESHOLD = 50;

interface ProductFullAnalysisProps {
  readonly profile: ProductProfile;
  readonly productId: number;
  readonly activeTab: ProductAnalysisTab;
  readonly onActiveTabChange: Dispatch<SetStateAction<ProductAnalysisTab>>;
  readonly onCollapse: () => void;
}

export default function ProductFullAnalysis({
  profile,
  productId,
  activeTab,
  onActiveTabChange,
  onCollapse,
}: ProductFullAnalysisProps) {
  const { t } = useTranslation();
  const touchStartX = useRef(0);

  const tabs: {
    key: ProductAnalysisTab;
    label: string;
    shortLabel: string;
  }[] = [
    {
      key: "overview",
      label: t("product.overview"),
      shortLabel: t("product.overviewShort"),
    },
    {
      key: "nutrition",
      label: t("product.nutrition"),
      shortLabel: t("product.nutritionShort"),
    },
    {
      key: "alternatives",
      label: t("product.alternatives"),
      shortLabel: t("product.alternativesShort"),
    },
    {
      key: "scoring",
      label: t("product.scoring"),
      shortLabel: t("product.scoringShort"),
    },
  ];

  const handleTouchStart = useCallback((event: TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      const diff = touchStartX.current - event.changedTouches[0].clientX;
      if (Math.abs(diff) > SWIPE_THRESHOLD) {
        onActiveTabChange((previous) => {
          const index = TAB_ORDER.indexOf(previous);
          const next = index + (diff > 0 ? 1 : -1);
          return TAB_ORDER[Math.max(0, Math.min(next, TAB_ORDER.length - 1))];
        });
      }
    },
    [onActiveTabChange],
  );

  return (
    <>
      {/* Collapse to summary */}
      <button
        type="button"
        onClick={onCollapse}
        data-testid="toggle-analysis"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground-secondary transition-colors hover:bg-surface-muted"
      >
        <ChevronUp className="h-4 w-4" />
        {t("product.showSummary")}
      </button>

      {/* Tab bar */}
      <div
        className="flex gap-1 rounded-lg bg-surface-muted p-1"
        role="tablist"
        data-testid="tab-bar"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            id={`tab-${tab.key}`}
            onClick={() => onActiveTabChange(tab.key)}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-label={tab.label}
            className={`flex-1 cursor-pointer rounded-md px-2 py-2.5 text-sm font-medium transition-colors sm:px-3 ${
              activeTab === tab.key
                ? "bg-surface text-brand shadow-sm"
                : "text-foreground-secondary hover:text-foreground"
            }`}
          >
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content — swipeable on touch devices */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        data-testid="tab-content"
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
      >
        <ErrorBoundary
          level="section"
          context={{ section: "tab-content", productId, tab: activeTab }}
        >
          {activeTab === "overview" && <OverviewTab profile={profile} />}
          {activeTab === "nutrition" && <NutritionTab profile={profile} />}
          {activeTab === "alternatives" && (
            <AlternativesSection
              alternatives={profile.alternatives}
              currentScore={profile.scores.unhealthiness_score}
            />
          )}
          {activeTab === "scoring" && <ScoringTab profile={profile} />}
        </ErrorBoundary>
      </div>
    </>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({ profile }: Readonly<{ profile: ProductProfile }>) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Ingredients */}
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-foreground-secondary lg:text-base">
          {t("product.ingredients")}
        </h2>
        <IngredientList ingredients={profile.ingredients} />
      </div>

      {/* Allergens */}
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-foreground-secondary lg:text-base">
          {t("product.allergens")}
        </h2>
        <AllergenMatrix allergens={profile.allergens} />
      </div>

      {/* Data quality */}
      <DataQualityCard quality={profile.quality} />

      {/* Eco-Score placeholder – hidden until FEATURES.ECO_SCORE is enabled */}
      {FEATURES.ECO_SCORE && (
        <div className="card">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground-secondary lg:text-base">
            <Globe size={16} aria-hidden="true" /> {t("product.ecoScoreTitle")}
          </h2>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-info-border bg-info-bg/50 px-3 py-3">
            <Info size={18} className="shrink-0 text-info-text" aria-hidden="true" />
            <p className="text-sm text-info-text">{t("product.ecoScoreComingSoon")}</p>
          </div>
        </div>
      )}

      {/* Product image gallery */}
      <ProductImageTabs
        images={profile.images}
        productName={profile.product.product_name_display ?? profile.product.product_name}
      />
    </div>
  );
}

// ─── Nutrition Tab ──────────────────────────────────────────────────────────

type NutritionView = "per100g" | "perServing";

function NutritionTab({ profile }: Readonly<{ profile: ProductProfile }>) {
  const { t } = useTranslation();
  const hasServing = profile.nutrition.per_serving !== null;
  const [view, setView] = useState<NutritionView>("per100g");

  const n =
    view === "perServing" && profile.nutrition.per_serving
      ? profile.nutrition.per_serving
      : profile.nutrition.per_100g;
  const dv = profile.nutrition.daily_values;
  const dvData = view === "perServing" ? (dv?.per_serving ?? null) : (dv?.per_100g ?? null);

  const energyKj = Math.round(n.calories_kcal * 4.184);
  const sodiumMg = Math.round(n.salt_g * 400);

  const rows = [
    {
      label: t("product.caloriesLabel"),
      value: `${n.calories_kcal} kcal / ${energyKj} kJ`,
      dv: dvData?.calories ?? null,
      tl: null as ReturnType<typeof getTrafficLight>,
    },
    {
      label: t("product.totalFat"),
      value: `${n.total_fat_g} g`,
      dv: dvData?.total_fat ?? null,
      tl: getTrafficLight("total_fat", n.total_fat_g),
    },
    {
      label: t("product.saturatedFat"),
      value: `${n.saturated_fat_g} g`,
      dv: dvData?.saturated_fat ?? null,
      tl: getTrafficLight("saturated_fat", n.saturated_fat_g),
    },
    {
      label: t("product.transFat"),
      value: n.trans_fat_g === null ? "—" : `${n.trans_fat_g} g`,
      dv: dvData?.trans_fat ?? null,
      tl: null as ReturnType<typeof getTrafficLight>,
    },
    {
      label: t("product.carbs"),
      value: `${n.carbs_g} g`,
      dv: dvData?.carbs ?? null,
      tl: null as ReturnType<typeof getTrafficLight>,
    },
    {
      label: t("product.sugars"),
      value: `${n.sugars_g} g`,
      dv: dvData?.sugars ?? null,
      tl: getTrafficLight("sugars", n.sugars_g),
    },
    {
      label: t("product.fibre"),
      value: n.fibre_g === null ? "—" : `${n.fibre_g} g`,
      dv: dvData?.fiber ?? null,
      tl: getTrafficLight("fibre", n.fibre_g),
      beneficial: true,
    },
    {
      label: t("product.protein"),
      value: `${n.protein_g} g`,
      dv: dvData?.protein ?? null,
      tl: getTrafficLight("protein", n.protein_g),
      beneficial: true,
    },
    {
      label: t("product.salt"),
      value: `${n.salt_g} g`,
      dv: dvData?.salt ?? null,
      tl: getTrafficLight("salt", n.salt_g),
    },
  ];

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground-secondary lg:text-base">
          {view === "perServing" && profile.nutrition.per_serving
            ? t("product.nutritionPerServing", {
                size: profile.nutrition.per_serving.serving_size,
              })
            : t("product.nutritionPer100g")}
        </h2>
        <div className="flex items-center gap-2">
          {hasServing && (
            <div
              className="flex rounded-lg border border-border bg-surface-subtle p-0.5"
              role="radiogroup"
              aria-label={t("product.nutritionViewToggle")}
            >
              <label
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  view === "per100g"
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-foreground-muted hover:text-foreground-secondary"
                }`}
              >
                <input
                  type="radio"
                  name="nutritionView"
                  className="sr-only"
                  value="per100g"
                  checked={view === "per100g"}
                  onChange={() => setView("per100g")}
                />
                {t("product.per100g")}
              </label>
              <label
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  view === "perServing"
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-foreground-muted hover:text-foreground-secondary"
                }`}
              >
                <input
                  type="radio"
                  name="nutritionView"
                  className="sr-only"
                  value="perServing"
                  checked={view === "perServing"}
                  onChange={() => setView("perServing")}
                />
                {t("product.perServing")}
              </label>
            </div>
          )}
          {dv && dv.reference_type !== "none" && (
            <DVReferenceBadge referenceType={dv.reference_type} regulation={dv.regulation} />
          )}
        </div>
      </div>

      {/* Traffic light summary strip */}
      <div className="mb-3">
        <TrafficLightStrip nutrition={n} />
      </div>

      <table className="w-full text-sm">
        <thead className="hidden text-xs text-foreground-muted lg:table-header-group">
          <tr className="border-b border-border">
            <th className="pb-2 text-left font-medium">{t("product.nutrient")}</th>
            <th className="pb-2 text-right font-medium">
              {view === "perServing" ? t("product.perServing") : t("product.per100g")}
            </th>
            <th className="pb-2 pl-4 text-left font-medium">{t("product.dailyValue")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <NutritionDVBar
              key={row.label}
              label={row.label}
              rawValue={row.value}
              dv={row.dv}
              trafficLight={row.tl}
              beneficial={row.beneficial}
            />
          ))}
        </tbody>
      </table>
      {dv && dv.reference_type !== "none" && <DVLegend />}

      {/* Sodium / Salt context note */}
      <div className="mt-3 rounded-lg bg-info-bg px-3 py-2 text-xs text-info-text">
        <span className="font-medium">{t("product.sodiumNote")}</span>{" "}
        {t("product.sodiumValue", { mg: sodiumMg })}
      </div>

      {/* Glycemic Index indicator */}
      {profile.nutrition.gi_estimate != null && (
        <GlycemicIndexIndicator gi={profile.nutrition.gi_estimate} />
      )}
    </div>
  );
}

// ─── Glycemic Index Indicator ───────────────────────────────────────────────

function giBand(score: number): "low" | "medium" | "high" {
  if (score <= 55) return "low";
  if (score <= 69) return "medium";
  return "high";
}

function GlycemicIndexIndicator({ gi }: Readonly<{ gi: number }>) {
  const { t } = useTranslation();

  const band = giBand(gi);

  const config = {
    low: {
      bg: "bg-success-bg",
      border: "border-success-border",
      text: "text-success-text",
      badge: "bg-success-bg text-success-text",
      label: t("product.gi.low"),
    },
    medium: {
      bg: "bg-warning-bg",
      border: "border-warning-border",
      text: "text-warning-text",
      badge: "bg-warning-bg text-warning-text",
      label: t("product.gi.medium"),
    },
    high: {
      bg: "bg-error-bg",
      border: "border-error-border",
      text: "text-error-text",
      badge: "bg-error-bg text-error-text",
      label: t("product.gi.high"),
    },
  };

  const c = config[band];

  return (
    <div
      className={`mt-3 rounded-lg border ${c.border} ${c.bg} px-3 py-3`}
      data-testid="gi-indicator"
    >
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${c.text}`}>{t("product.gi.label")}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.badge}`}
          data-testid="gi-badge"
        >
          {c.label} ({gi})
        </span>
      </div>
    </div>
  );
}

// ─── Data Quality Card ──────────────────────────────────────────────────────

function DataQualityCard({ quality }: Readonly<{ quality: DataConfidence }>) {
  const { t } = useTranslation();
  const q = quality as Record<string, unknown>;
  const band = (q.confidence_band as string) ?? "unknown";
  const score = (q.confidence_score as number) ?? 0;

  const bandConfig: Record<string, { bg: string; fill: string; label: string }> = {
    high: { bg: "bg-success-bg", fill: "bg-success", label: "✓" },
    medium: { bg: "bg-warning-bg", fill: "bg-warning", label: "~" },
    low: { bg: "bg-error-bg", fill: "bg-error", label: "!" },
    unknown: { bg: "bg-surface-muted", fill: "bg-neutral-400", label: "?" },
  };

  const cfg = bandConfig[band] ?? bandConfig.unknown;

  return (
    <div className="card">
      <h2 className="mb-2 text-sm font-semibold text-foreground-secondary lg:text-base">
        {t("product.dataQuality")}
      </h2>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${cfg.bg}`}
        >
          {cfg.label}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium capitalize text-foreground">
              {t("product.confidence", { value: band })}
            </span>
            <span className="text-xs text-foreground-muted">{score}%</span>
          </div>
          <div className={`mt-1 h-2 w-full overflow-hidden rounded-full ${cfg.bg}`}>
            <div
              className={`h-full rounded-full transition-all ${cfg.fill}`}
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Scoring Tab ────────────────────────────────────────────────────────────

/** Convert snake_case to Title Case: "saturated_fat" → "Saturated Fat" */
function formatSnakeCase(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Human-friendly factor name mapping */
const FACTOR_LABELS: Record<string, string> = {
  saturated_fat: "Saturated Fat",
  trans_fat: "Trans Fat",
  sugars: "Sugars",
  salt: "Salt",
  calories: "Calories",
  additives: "Additives",
  prep_method: "Preparation Method",
  controversies: "Controversies",
  ingredient_concern: "Ingredient Concern",
};

function formatFactorName(name: string): string {
  return FACTOR_LABELS[name] ?? formatSnakeCase(name);
}

function ScoringTab({ profile }: Readonly<{ profile: ProductProfile }>) {
  const { t } = useTranslation();
  const scores = profile.scores;

  const topFactors = Array.isArray(scores.score_breakdown)
    ? scores.score_breakdown.toSorted((a, b) => (b.weighted ?? 0) - (a.weighted ?? 0)).slice(0, 5)
    : [];

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Summary */}
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-foreground-secondary lg:text-base">
          {t("product.summary")}
        </h2>
        <p className="text-sm text-foreground-secondary">{scores.headline}</p>
      </div>

      {/* Radar chart */}
      {Array.isArray(scores.score_breakdown) && scores.score_breakdown.length > 0 && (
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-foreground-secondary lg:text-base">
            {t("product.scoreBreakdown")}
          </h2>
          <ScoreRadarChart breakdown={scores.score_breakdown} />
        </div>
      )}

      {/* Detailed score breakdown (lazy-loaded) */}
      <ScoreBreakdownPanel
        productId={profile.product.product_id}
        score={toTryVitScore(scores.unhealthiness_score)}
        scoreBand={
          SCORE_BANDS[scores.score_band]
            ? t(SCORE_BANDS[scores.score_band].labelKey)
            : scores.score_band
        }
      />

      {/* NOVA processing indicator */}
      {scores.nova_group && (
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-foreground-secondary lg:text-base">
            {t("product.processingLevel")}
          </h2>
          <NovaIndicator novaGroup={scores.nova_group} />
        </div>
      )}

      {/* Score breakdown factors */}
      {topFactors.length > 0 && (
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-foreground-secondary lg:text-base">
            {t("product.topScoreFactors")}
          </h2>
          <div className="space-y-2">
            {topFactors.map((f) => (
              <div key={String(f.name)} className="flex items-center justify-between text-sm">
                <span className="text-foreground-secondary">
                  {formatFactorName(String(f.name))}
                </span>
                <span className="font-medium text-foreground">
                  +{Number(f.weighted).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {profile.warnings.length > 0 && (
        <div className="card border-warning-border bg-warning-bg">
          <h2 className="mb-2 text-sm font-semibold text-warning-text lg:text-base">
            {t("product.warnings")}
          </h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-warning-text/80">
            {profile.warnings.map((w) => (
              <li key={w.type}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Category context */}
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-foreground-secondary lg:text-base">
          {t("product.categoryContext")}
        </h2>
        <div className="text-sm text-foreground-secondary">
          <div className="flex items-center gap-2">
            <p>
              {t("product.rank", {
                rank: scores.category_context.rank,
                total: scores.category_context.total_in_category,
              })}
            </p>
            <PercentileBadge
              rank={scores.category_context.rank}
              total={scores.category_context.total_in_category}
            />
          </div>
          <p>
            {t("product.categoryAvg", {
              avg: Math.round(scores.category_context.category_avg_score),
            })}
          </p>
          <p>
            {t("product.position", {
              position: formatSnakeCase(scores.category_context.relative_position),
            })}
          </p>
        </div>
      </div>

      {/* Score history */}
      <ScoreHistoryPanel productId={profile.product.product_id} />
    </div>
  );
}
