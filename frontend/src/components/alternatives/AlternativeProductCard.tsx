import { ScoreComparisonBar } from "@/components/alternatives/ScoreComparisonBar";
import { NutriScoreBadge } from "@/components/common/NutriScoreBadge";
import {
  ProductRegisterCard,
  type ProductRegisterEvidenceState,
} from "@/components/product/ProductRegisterCard";
import { scoreBandFromScore } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import type { ProfileAlternative } from "@/lib/types";

interface AlternativeProductCardProps {
  readonly alt: ProfileAlternative;
  readonly currentScore: number;
  readonly evidence?: ProductRegisterEvidenceState;
  readonly comparisonAllowed?: boolean;
}

function getVerdictKey(delta: number): string {
  if (delta >= 20) return "product.verdictMuchHealthier";
  if (delta >= 10) return "product.verdictHealthier";
  return "product.verdictSlightlyHealthier";
}

export function AlternativeProductCard({
  alt,
  currentScore,
  evidence,
  comparisonAllowed = false,
}: AlternativeProductCardProps) {
  const { t } = useTranslation();

  return (
    <ProductRegisterCard
      productId={alt.product_id}
      href={`/app/product/${alt.product_id}`}
      name={alt.product_name}
      brand={alt.brand}
      category={alt.category}
      score={alt.unhealthiness_score}
      scoreBand={scoreBandFromScore(alt.unhealthiness_score)}
      evidence={evidence}
      variant="list"
      muted={!comparisonAllowed}
      highlight={
        comparisonAllowed
          ? `${t("product.pointsBetter", { points: alt.score_delta })} · ${t(
              getVerdictKey(alt.score_delta),
            )}`
          : undefined
      }
      meta={
        comparisonAllowed ? (
          <ScoreComparisonBar
            currentScore={currentScore}
            alternativeScore={alt.unhealthiness_score}
          />
        ) : undefined
      }
      badges={
        <>
          <NutriScoreBadge grade={alt.nutri_score} size="sm" showTooltip />
          {alt.similarity > 0 ? (
            <span>
              {Math.round(alt.similarity * 100)}% {t("product.ingredientMatch")}
            </span>
          ) : null}
        </>
      }
    />
  );
}
