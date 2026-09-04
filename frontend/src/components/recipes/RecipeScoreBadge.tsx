"use client";

import { useTranslation } from "@/lib/i18n";
import { getScoreBand, toTryVitScore } from "@/lib/score-utils";
import type { RecipeScore } from "@/lib/types";
import React from "react";

export interface RecipeScoreBadgeProps {
  readonly score: RecipeScore | null | undefined;
  readonly showNutrition?: boolean;
  readonly className?: string;
}

const NUTRIENTS = [
  { field: "avg_calories", name: "calories", unit: "kcal" },
  { field: "avg_protein_g", name: "protein", unit: "g" },
  { field: "avg_total_fat_g", name: "fat", unit: "g" },
  { field: "avg_sugars_g", name: "sugars", unit: "g" },
  { field: "avg_salt_g", name: "salt", unit: "g" },
  { field: "avg_fibre_g", name: "fibre", unit: "g" },
] as const;

/** Product averages describe the linked evidence, not the prepared recipe. */
export const RecipeScoreBadge = React.memo(function RecipeScoreBadge({
  score,
  showNutrition = false,
  className = "",
}: Readonly<RecipeScoreBadgeProps>) {
  const { t, language } = useTranslation();

  if (!score || "error" in score) return null;

  const cardClass = [
    "rounded-xl border border-border bg-surface p-4",
    className,
  ].filter(Boolean).join(" ");

  if (score.linked_count === 0) {
    return (
      <div className={cardClass} data-testid="recipe-score-empty">
        <p className="text-sm text-foreground-muted">{t("recipeScore.noLinks")}</p>
      </div>
    );
  }

  // The RPC uses 0 when no scored product contributes. Do not invert that
  // sentinel into a perfect score, or clamp malformed scores into valid ones.
  const band = getScoreBand(score.aggregate_score);
  const displayScore = band ? toTryVitScore(score.aggregate_score) : null;
  const coverage = Number.isFinite(score.coverage_pct)
    ? Math.max(0, Math.min(100, score.coverage_pct))
    : null;
  const numberFormat = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });

  return (
    <div className={cardClass} data-testid="recipe-score-badge">
      <div className="flex items-start gap-3">
        {displayScore !== null && band && (
          <span
            role="img"
            className={`inline-flex shrink-0 items-baseline gap-0.5 rounded-xl px-3 py-2 ${band.bgColor} ${band.textColor}`}
            aria-label={t("recipeScore.scoreLabel", { score: displayScore })}
          >
            <span className="text-2xl font-bold tabular-nums">{displayScore}</span>
            <span className="text-xs">/100</span>
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{t("recipeScore.title")}</h3>
          <p className="mt-1 text-xs text-foreground-muted">
            {displayScore === null ? t("recipeScore.unavailable") : t("recipeScore.direction")}
          </p>
        </div>
      </div>

      <div className="mt-4" data-testid="recipe-score-coverage">
        <p className="text-xs text-foreground-secondary">
          {t("recipeScore.linkedIngredients", {
            linked: score.linked_count,
            total: score.ingredient_count,
          })}
        </p>
        {coverage !== null && (
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
            role="progressbar"
            aria-label={t("recipeScore.coverageLabel")}
            aria-valuenow={coverage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={t("recipeScore.coverage", { percent: numberFormat.format(coverage) })}
          >
            <div className="h-full rounded-full bg-brand-primary" style={{ width: `${coverage}%` }} />
          </div>
        )}
        <p className="mt-2 text-xs leading-relaxed text-foreground-muted">{t("recipeScore.evidenceNote")}</p>
      </div>

      {showNutrition && (
        <div className="mt-4 border-t border-border pt-4" data-testid="recipe-score-nutrition">
          <h4 className="text-xs font-semibold text-foreground-secondary">{t("recipeScore.nutritionTitle")}</h4>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
            {NUTRIENTS.map(({ field, name, unit }) => {
              const value = score.nutrition_summary?.[field];
              const known = typeof value === "number" && Number.isFinite(value) && value >= 0;
              return (
                <div key={field} data-testid={`recipe-nutrient-${name}`}>
                  <dt className="text-xs text-foreground-muted">{t(`recipeScore.nutrients.${name}`)}</dt>
                  <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                    {known ? `${numberFormat.format(value)} ${unit}` : t("recipeScore.unknown")}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-foreground-muted">{t("recipeScore.nutritionNote")}</p>
        </div>
      )}
    </div>
  );
});
