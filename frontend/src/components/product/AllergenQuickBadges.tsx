"use client";

import { getAllergenEvidence } from "@/lib/allergen-evidence";
import { useTranslation } from "@/lib/i18n";
import type { ProfileAllergens } from "@/lib/types";
import { AlertTriangle, CircleHelp, Dna } from "lucide-react";

interface AllergenQuickBadgesProps {
  readonly allergens: ProfileAllergens;
}

export function AllergenQuickBadges({ allergens }: AllergenQuickBadgesProps) {
  const { t } = useTranslation();
  const evidence = getAllergenEvidence(allergens);
  const contains = evidence.filter((item) => item.evidence_type === "contains");
  const traces = evidence.filter((item) => item.evidence_type === "may_contain");

  if (evidence.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
          <span>{t("product.allergenEvidenceUnavailable")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {t("allergenMatrix.title")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {contains.map((item) => {
          const isDerived = item.evidence_basis === "ingredient_derived";
          const Icon = isDerived ? Dna : AlertTriangle;
          return (
            <span
              key={`c-${item.tag}`}
              className="inline-flex items-center gap-1 rounded-full bg-error-bg px-2 py-0.5 text-xs font-medium text-error-text"
              title={t(
                isDerived
                  ? "allergenMatrix.derived"
                  : item.evidence_basis === "explicit_source"
                    ? "allergenMatrix.explicitSource"
                    : "allergenMatrix.provenanceUnavailable",
              )}
            >
              <Icon className="h-3 w-3 flex-shrink-0" aria-hidden />
              {item.tag}
              {isDerived && (
                <span className="font-normal">
                  ({t("allergenMatrix.derivedShort")})
                </span>
              )}
            </span>
          );
        })}
        {traces.map((item) => (
          <span
            key={`t-${item.tag}`}
            className="rounded-full bg-warning-bg px-2 py-0.5 text-xs text-warning-text"
            title={t("allergenMatrix.traces")}
          >
            {item.tag}
          </span>
        ))}
      </div>
    </div>
  );
}
