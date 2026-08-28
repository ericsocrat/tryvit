"use client";

import { ProductThumbnail } from "@/components/common/ProductThumbnail";
import {
  getProvenanceDisposition,
  type ProvenanceDisposition,
} from "@/hooks/use-product-provenance";
import { SCORE_BANDS, scoreBandFromScore } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { toTryVitScore } from "@/lib/score-utils";
import type { ProductProvenance, ScoreBand } from "@/lib/types";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./ProductRegisterCard.module.css";

interface EvidenceState {
  readonly data?: ProductProvenance;
  readonly isLoading?: boolean;
  readonly error?: Error | null;
}

export interface ProductRegisterCardProps {
  readonly productId: number;
  readonly href: string;
  readonly name: string;
  readonly brand?: string | null;
  readonly category?: string | null;
  readonly categorySlug?: string;
  readonly categoryIcon?: string;
  readonly imageUrl?: string | null;
  readonly score?: number | null;
  readonly scoreBand?: ScoreBand;
  readonly evidence?: EvidenceState;
  readonly detail?: string;
  readonly meta?: ReactNode;
  readonly badges?: ReactNode;
  readonly actions?: ReactNode;
  readonly variant?: "grid" | "list";
  readonly muted?: boolean;
  readonly highlight?: string;
}

type CardDisposition = ProvenanceDisposition | "unavailable" | "loading";

const EVIDENCE_KEY: Readonly<Record<CardDisposition, string>> = {
  confirmed: "trust.evidence.confirmedTitle",
  provisional: "trust.evidence.provisionalTitle",
  not_collected: "trust.evidence.notCollectedTitle",
  expired: "trust.evidence.expiredTitle",
  unavailable: "trust.evidence.unavailableTitle",
  loading: "trust.evidence.loading",
};

function evidenceDisposition(evidence: EvidenceState | undefined): CardDisposition {
  if (evidence?.isLoading) return "loading";
  if (evidence?.error || !evidence?.data) return "unavailable";
  return getProvenanceDisposition(evidence.data);
}

function resolveScoreState({
  productId,
  score,
  scoreBand,
  evidence,
}: Pick<ProductRegisterCardProps, "productId" | "score" | "scoreBand" | "evidence">) {
  const reportedDisposition = evidenceDisposition(evidence);
  const validScore =
    score !== null && score !== undefined && Number.isFinite(score) && score >= 0 && score <= 100;
  const matchingEvidence = evidence?.data?.product_id === productId;
  const matchingBand =
    validScore && scoreBand !== undefined && scoreBandFromScore(score) === scoreBand;
  const confirmed = reportedDisposition === "confirmed" && matchingEvidence && matchingBand;

  return {
    band: scoreBand ? SCORE_BANDS[scoreBand] : undefined,
    confirmed,
    disposition:
      reportedDisposition === "confirmed" && !confirmed
        ? ("provisional" as const)
        : reportedDisposition,
    numericScore: validScore ? toTryVitScore(score) : null,
  };
}

export function ProductRegisterCard({
  productId,
  href,
  name,
  brand,
  category,
  categorySlug,
  categoryIcon,
  imageUrl,
  score,
  scoreBand,
  evidence,
  detail,
  meta,
  badges,
  actions,
  variant = "list",
  muted = false,
  highlight,
}: ProductRegisterCardProps) {
  const { t } = useTranslation();
  const { band, confirmed, disposition, numericScore } = resolveScoreState({
    productId,
    score,
    scoreBand,
    evidence,
  });
  const scoreLabel = `${t("filters.healthScore")} — ${
    confirmed && band ? t(band.labelKey) : t("trust.evidence.scoreProvisionalLabel")
  }`;

  return (
    <li
      className={[styles.registerCard, styles[variant], muted ? styles.muted : ""]
        .filter(Boolean)
        .join(" ")}
      data-evidence-disposition={disposition}
      data-testid="product-register-card"
    >
      <Link href={href} className={styles.link}>
        <div className={styles.media}>
          <ProductThumbnail
            imageUrl={imageUrl}
            productName={name}
            categorySlug={categorySlug}
            categoryIcon={categoryIcon}
            size={variant === "grid" ? "md" : "sm"}
          />
          <div
            className={[
              styles.score,
              confirmed && band ? styles.scoreConfirmed : "",
              confirmed && band ? band.bg : "",
              confirmed && band ? band.color : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {numericScore === null ? (
              <output aria-label={scoreLabel}>—</output>
            ) : (
              <>
                <meter
                  className={styles.semanticMeter}
                  min={0}
                  max={100}
                  value={numericScore}
                  aria-label={scoreLabel}
                >
                  {numericScore}
                </meter>
                <span aria-hidden="true">{numericScore}</span>
              </>
            )}
          </div>
        </div>
        <div className={styles.identity}>
          {category ? <p className={styles.eyebrow}>{category}</p> : null}
          <p className={styles.name}>{name}</p>
          {brand ? <p className={styles.brand}>{brand}</p> : null}
          {detail ? <p className={styles.detail}>{detail}</p> : null}
          <span className={[styles.evidence, styles[disposition]].join(" ")}>
            {t(EVIDENCE_KEY[disposition])}
          </span>
          {highlight ? <span className={styles.highlight}>{highlight}</span> : null}
        </div>
      </Link>
      {(meta !== null && meta !== undefined) || (badges !== null && badges !== undefined) ? (
        <div className={styles.support}>
          {meta ? <div className={styles.meta}>{meta}</div> : null}
          {badges ? <div className={styles.badges}>{badges}</div> : null}
        </div>
      ) : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </li>
  );
}

export type { EvidenceState as ProductRegisterEvidenceState };
