"use client";

import { Button } from "@/components/common/Button";
import { SourceAttribution, type SourceField } from "@/components/trust/SourceAttribution";
import { TrustBadge } from "@/components/trust/TrustBadge";
import {
  getProvenanceDisposition,
  type ProvenanceDisposition,
} from "@/hooks/use-product-provenance";
import { useTranslation } from "@/lib/i18n";
import type { ProductProvenance } from "@/lib/types";
import { AlertTriangle, Clock3, Database } from "lucide-react";
import { useId } from "react";

import styles from "./ProductEvidencePanel.module.css";

interface ProductEvidencePanelProps {
  readonly provenance: ProductProvenance | undefined;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly onRetry: () => void;
  readonly compact?: boolean;
}

function daysSince(value: string): number | null {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp > Date.now()) return null;
  return Math.floor((Date.now() - timestamp) / 86_400_000);
}

function fieldLabel(field: string): string {
  return field
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toSourceFields(provenance: ProductProvenance): SourceField[] {
  return Object.entries(provenance.field_sources ?? {}).map(([field, source]) => ({
    field: fieldLabel(field),
    source: source.source,
    daysSinceUpdate: daysSince(source.last_updated),
  }));
}

const DISPOSITION_COPY: Record<
  ProvenanceDisposition,
  { titleKey: string; descriptionKey: string }
> = {
  confirmed: {
    titleKey: "trust.evidence.confirmedTitle",
    descriptionKey: "trust.evidence.confirmedDescription",
  },
  provisional: {
    titleKey: "trust.evidence.provisionalTitle",
    descriptionKey: "trust.evidence.provisionalDescription",
  },
  not_collected: {
    titleKey: "trust.evidence.notCollectedTitle",
    descriptionKey: "trust.evidence.notCollectedDescription",
  },
  expired: {
    titleKey: "trust.evidence.expiredTitle",
    descriptionKey: "trust.evidence.expiredDescription",
  },
};

export function ProductEvidencePanel({
  provenance,
  isLoading,
  error,
  onRetry,
  compact = false,
}: ProductEvidencePanelProps) {
  const { t } = useTranslation();
  const titleId = useId();

  if (isLoading) {
    return (
      <output
        className={styles.loading}
        aria-live="polite"
        aria-busy="true"
        data-testid="product-evidence-loading"
      >
        {t("trust.evidence.loading")}
      </output>
    );
  }

  if (error || !provenance) {
    return (
      <div className={styles.error} role="alert" data-testid="product-evidence-unavailable">
        <p className={styles.errorTitle}>
          <AlertTriangle size={16} aria-hidden="true" />
          {t("trust.evidence.unavailableTitle")}
        </p>
        <p className={styles.errorDescription}>{t("trust.evidence.unavailableDescription")}</p>
        <Button className={styles.retry} size="sm" variant="secondary" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  const disposition = getProvenanceDisposition(provenance);
  const copy = DISPOSITION_COPY[disposition];
  const sources = toSourceFields(provenance);
  const freshnessKey =
    disposition === "not_collected"
      ? "trust.evidence.freshness.unavailable"
      : ["fresh", "aging", "stale", "expired"].includes(provenance.freshness_status)
        ? `trust.evidence.freshness.${provenance.freshness_status}`
        : "trust.evidence.freshness.unavailable";

  return (
    <section
      className={styles.panel}
      aria-labelledby={titleId}
      data-testid="product-evidence-panel"
    >
      <div className={styles.header}>
        <div className={styles.copy}>
          <h2 id={titleId} className={styles.title}>
            {t(copy.titleKey)}
          </h2>
          <p className={styles.description}>{t(copy.descriptionKey)}</p>
        </div>
        {disposition !== "not_collected" ? (
          <TrustBadge trustScore={provenance.overall_trust_score} size="sm" />
        ) : null}
      </div>

      <dl className={styles.metrics}>
        <div className={styles.metric}>
          <dt className={styles.metricLabel}>{t("trust.evidence.freshnessLabel")}</dt>
          <dd className={styles.metricValue}>
            <Clock3 size={12} aria-hidden="true" /> {t(freshnessKey)}
          </dd>
        </div>
        <div className={styles.metric}>
          <dt className={styles.metricLabel}>{t("trust.evidence.completenessLabel")}</dt>
          <dd className={styles.metricValue}>
            {disposition === "not_collected"
              ? t("trust.evidence.notCollectedValue")
              : provenance.data_completeness_pct == null
                ? t("common.unknown")
                : `${provenance.data_completeness_pct}%`}
          </dd>
        </div>
        <div className={styles.metric}>
          <dt className={styles.metricLabel}>{t("trust.evidence.sourcesLabel")}</dt>
          <dd className={styles.metricValue}>
            <Database size={12} aria-hidden="true" />
            {disposition === "not_collected"
              ? t("trust.evidence.notCollectedValue")
              : provenance.source_count == null
                ? t("common.unknown")
                : provenance.source_count}
          </dd>
        </div>
      </dl>

      {!compact ? (
        <div className={styles.sources}>
          <SourceAttribution sources={sources} />
        </div>
      ) : null}
    </section>
  );
}
