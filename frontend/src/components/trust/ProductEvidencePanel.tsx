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

interface ProductEvidencePanelProps {
  readonly provenance: ProductProvenance | undefined;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly onRetry: () => void;
  readonly compact?: boolean;
}

function daysSince(value: string): number | null {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function fieldLabel(field: string): string {
  return field
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toSourceFields(
  provenance: ProductProvenance,
): SourceField[] {
  return Object.entries(provenance.field_sources ?? {}).map(
    ([field, source]) => ({
      field: fieldLabel(field),
      source: source.source,
      daysSinceUpdate: daysSince(source.last_updated),
    }),
  );
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
        className="block rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground-secondary"
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
      <div
        className="rounded-xl border border-warning-border bg-warning-bg p-3"
        role="alert"
        data-testid="product-evidence-unavailable"
      >
        <p className="flex items-center gap-1.5 text-sm font-semibold text-warning-text">
          <AlertTriangle size={16} aria-hidden="true" />
          {t("trust.evidence.unavailableTitle")}
        </p>
        <p className="mt-1 text-xs text-warning-text">
          {t("trust.evidence.unavailableDescription")}
        </p>
        <Button className="mt-2" size="sm" variant="secondary" onClick={onRetry}>
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
      : ["fresh", "aging", "stale", "expired"].includes(
            provenance.freshness_status,
          )
        ? `trust.evidence.freshness.${provenance.freshness_status}`
        : "trust.evidence.freshness.unavailable";

  return (
    <section
      className="rounded-xl border border-border bg-surface p-3"
      aria-labelledby={titleId}
      data-testid="product-evidence-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={titleId} className="text-sm font-semibold text-foreground">
            {t(copy.titleKey)}
          </h2>
          <p className="mt-0.5 text-xs text-foreground-secondary">
            {t(copy.descriptionKey)}
          </p>
        </div>
        {disposition !== "not_collected" && (
          <TrustBadge trustScore={provenance.overall_trust_score} size="sm" />
        )}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-foreground-muted">{t("trust.evidence.freshnessLabel")}</dt>
          <dd className="flex items-center gap-1 font-medium text-foreground-secondary">
            <Clock3 size={12} aria-hidden="true" /> {t(freshnessKey)}
          </dd>
        </div>
        <div>
          <dt className="text-foreground-muted">{t("trust.evidence.completenessLabel")}</dt>
          <dd className="font-medium text-foreground-secondary">
            {disposition === "not_collected"
              ? t("trust.evidence.notCollectedValue")
              : provenance.data_completeness_pct == null
              ? t("common.unknown")
              : `${provenance.data_completeness_pct}%`}
          </dd>
        </div>
        <div>
          <dt className="text-foreground-muted">{t("trust.evidence.sourcesLabel")}</dt>
          <dd className="flex items-center gap-1 font-medium text-foreground-secondary">
            <Database size={12} aria-hidden="true" />
            {disposition === "not_collected"
              ? t("trust.evidence.notCollectedValue")
              : provenance.source_count == null
              ? t("common.unknown")
              : provenance.source_count}
          </dd>
        </div>
      </dl>

      {!compact && (
        <div className="mt-3">
          <SourceAttribution sources={sources} />
        </div>
      )}
    </section>
  );
}
