import { useTranslation } from "@/lib/i18n";
import { BarChart3, User } from "lucide-react";

/**
 * Human-readable labels for regulation constants stored in the DB.
 * Keys match the `daily_value_references.regulation` column values.
 * - `eu_ri` = EU Reference Intakes, Regulation (EU) No 1169/2011
 */
const REGULATION_LABELS: Readonly<Record<string, string>> = {
  eu_ri: "EU Reference Intakes",
  fda_dv: "FDA Daily Values",
};

/** Resolve a raw regulation constant to its display label. */
export function resolveRegulationLabel(regulation: string | undefined): string {
  if (!regulation) return "EU RI";
  return REGULATION_LABELS[regulation] ?? regulation;
}

interface DVReferenceBadgeProps {
  readonly referenceType: "standard" | "personalized" | "none";
  readonly regulation?: string;
}

export function DVReferenceBadge({
  referenceType,
  regulation,
}: DVReferenceBadgeProps) {
  const { t } = useTranslation();

  if (referenceType === "none") return null;

  const isPersonalized = referenceType === "personalized";
  const label = isPersonalized
    ? t("product.dvPersonalized")
    : t("product.dvStandard", {
        regulation: resolveRegulationLabel(regulation),
      });

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isPersonalized
          ? "bg-info-bg text-info-text"
          : "bg-surface-muted text-foreground-secondary"
      }`}
    >
      {isPersonalized ? (
        <User size={14} aria-hidden="true" />
      ) : (
        <BarChart3 size={14} aria-hidden="true" />
      )}{" "}
      {label}
    </span>
  );
}
