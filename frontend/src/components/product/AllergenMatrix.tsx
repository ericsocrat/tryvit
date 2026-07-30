"use client";

import {
  buildAllergenDisplayRows,
  getAllergenEvidence,
  type AllergenDisplayStatus,
} from "@/lib/allergen-evidence";
import { useTranslation } from "@/lib/i18n";
import type { ProfileAllergens } from "@/lib/types";
import { AlertTriangle, Check, CircleHelp, Dna, Minus } from "lucide-react";

const STATUS_CONFIG: Record<
  AllergenDisplayStatus,
  { bg: string; border: string; text: string; label: string }
> = {
  contains: {
    bg: "bg-error-bg",
    border: "border-error-border",
    text: "text-error-text",
    label: "allergenMatrix.contains",
  },
  derived: {
    bg: "bg-warning-bg",
    border: "border-warning-border",
    text: "text-warning-text",
    label: "allergenMatrix.derived",
  },
  may_contain: {
    bg: "bg-warning-bg",
    border: "border-warning-border",
    text: "text-warning-text",
    label: "allergenMatrix.traces",
  },
  unknown: {
    bg: "bg-surface-muted",
    border: "border-border",
    text: "text-foreground-muted",
    label: "allergenMatrix.unknown",
  },
  assessed_absent: {
    bg: "bg-success-bg",
    border: "border-success-border",
    text: "text-success-text",
    label: "allergenMatrix.assessedAbsent",
  },
};

function StatusIcon({ status }: Readonly<{ status: AllergenDisplayStatus }>) {
  switch (status) {
    case "contains":
      return <AlertTriangle size={13} aria-hidden="true" />;
    case "derived":
      return <Dna size={13} aria-hidden="true" />;
    case "may_contain":
      return <Minus size={13} aria-hidden="true" />;
    case "unknown":
      return <CircleHelp size={13} aria-hidden="true" />;
    case "assessed_absent":
      return <Check size={13} aria-hidden="true" />;
  }
}

interface AllergenMatrixProps {
  readonly allergens: ProfileAllergens;
}

export function AllergenMatrix({ allergens }: AllergenMatrixProps) {
  const { t } = useTranslation();
  const rows = buildAllergenDisplayRows(allergens);
  const evidence = getAllergenEvidence(allergens);
  const hasEvidence = evidence.length > 0;

  return (
    <div className="space-y-3">
      {!hasEvidence && (
        <p className="flex items-center gap-1.5 text-sm text-foreground-muted">
          <CircleHelp size={14} aria-hidden="true" />
          {t("product.allergenEvidenceUnavailable")}
        </p>
      )}

      <table
        className="w-full border-separate border-spacing-1.5"
        aria-label={t("allergenMatrix.title")}
      >
        <tbody>
          {rows.map((row) => {
            const config = STATUS_CONFIG[row.status];
            return (
              <tr key={row.name}>
                <td
                  className={`rounded-lg border px-2.5 py-1.5 ${config.bg} ${config.border}`}
                >
                  <span className={`flex items-center gap-1.5 ${config.text}`}>
                    <StatusIcon status={row.status} />
                    <span className="text-xs font-medium">
                      {t(`allergens.${row.name}`)}
                    </span>
                    <span className="ml-auto text-xxs font-normal">
                      {t(config.label)}
                    </span>
                  </span>
                  {row.evidenceBasis === "legacy_unclassified" && (
                    <span className="mt-0.5 block pl-[19px] text-xxs text-foreground-muted">
                      {t("allergenMatrix.provenanceUnavailable")}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex flex-wrap gap-3 text-xs text-foreground-muted">
        <span className="flex items-center gap-1">
          <AlertTriangle size={10} className="text-error" aria-hidden="true" />
          {t("allergenMatrix.contains")}
        </span>
        <span className="flex items-center gap-1">
          <Dna size={10} className="text-warning" aria-hidden="true" />
          {t("allergenMatrix.derived")}
        </span>
        <span className="flex items-center gap-1">
          <Minus size={10} className="text-warning" aria-hidden="true" />
          {t("allergenMatrix.traces")}
        </span>
        <span className="flex items-center gap-1">
          <CircleHelp size={10} aria-hidden="true" />
          {t("allergenMatrix.unknown")}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-foreground-muted">
        {t("allergenMatrix.disclaimer")}
      </p>
    </div>
  );
}
