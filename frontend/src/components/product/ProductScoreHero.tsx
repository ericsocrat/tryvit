"use client";

import { ScoreGauge } from "@/components/product/ScoreGauge";
import { useTranslation } from "@/lib/i18n";
import { getScoreBand, toTryVitScore } from "@/lib/score-utils";

export type ProductScoreHeroVariant = "card" | "inline";

interface ProductScoreHeroProps {
  readonly unhealthinessScore: number;
  readonly headline: string;
  readonly hasConflicts?: boolean;
  readonly provisional?: boolean;
  /** "card" = standalone card (default). "inline" = compact row for merged identity card. */
  readonly variant?: ProductScoreHeroVariant;
}

export function ProductScoreHero({
  unhealthinessScore,
  headline,
  hasConflicts = false,
  provisional = false,
  variant = "card",
}: ProductScoreHeroProps) {
  const { t } = useTranslation();
  const band = getScoreBand(unhealthinessScore);

  if (!band) return null;

  if (provisional) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg border border-warning-border bg-warning-bg px-3 py-2"
        data-testid={variant === "inline" ? "score-hero-inline" : "score-hero-provisional"}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-bold text-foreground">
          {toTryVitScore(unhealthinessScore)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-warning-text">
            {t("trust.evidence.scoreProvisionalLabel")}
          </p>
          <p className="text-xs text-warning-text">
            {t("trust.evidence.scoreNoGuidance")}
          </p>
        </div>
      </div>
    );
  }

  const bandLabel = t(
    `scoreInterpretation.${band.band === "darkred" ? "darkRed" : band.band}`,
  );
  const shortBandLabel = t(band.labelKey);

  if (variant === "inline") {
    return (
      <div
        className={`flex items-center gap-3 rounded-lg ${band.bgColor} border-l-4 px-3 py-1.5`}
        style={{ borderLeftColor: band.color }}
        data-testid="score-hero-inline"
      >
        <ScoreGauge score={unhealthinessScore} size="sm" />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${band.textColor}`}>
            {shortBandLabel}
          </p>
          <p className="truncate text-xs text-foreground-secondary">
            {headline}
          </p>
          {hasConflicts && (
            <p className="text-xs text-warning">
              {t("conflicts.qualifierSuffix")}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${band.bgColor} border-0`}>
      <div className="flex flex-col items-center gap-3 py-2">
        <ScoreGauge score={unhealthinessScore} size="xl" />
        <div className="text-center">
          <p className={`text-lg font-bold ${band.textColor}`}>{bandLabel}</p>
          <p className="mt-1 text-sm text-foreground-secondary">
            {headline}
          </p>
          {hasConflicts && (
            <p className="mt-0.5 text-xs text-warning">
              {t("conflicts.qualifierSuffix")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
