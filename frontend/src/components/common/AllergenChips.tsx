"use client";

import type { AllergenWarning } from "@/lib/allergen-matching";
import { useTranslation } from "@/lib/i18n";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Max visible chips before showing "+N more" overflow badge */
const MAX_VISIBLE = 3;

const CHIP_STYLES = {
  /** "Contains" — red/danger */
  contains:
    "bg-error-bg text-error-text border-error-border",
  /** "Traces" — amber/warning */
  traces:
    "bg-warning-bg text-warning-text border-warning-border",
} as const;

// ─── Single chip ────────────────────────────────────────────────────────────

interface AllergenChipProps {
  readonly warning: AllergenWarning;
}

function AllergenChip({ warning }: AllergenChipProps) {
  const { t } = useTranslation();
  const name = t(warning.labelKey);
  const style = CHIP_STYLES[warning.type];
  const tooltip =
    warning.evidenceBasis === "ingredient_derived"
      ? t("tooltip.allergen.derived", { name })
      : warning.type === "contains"
        ? t("tooltip.allergen.present", { name })
        : t("tooltip.allergen.traces", { name });

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xxs font-medium leading-tight shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[box-shadow,background-color,color] motion-reduce:transition-none ${style}`}
      title={tooltip}
      data-testid="allergen-chip"
    >
      <span aria-hidden="true">{warning.icon}</span>
      <span className="max-w-16 truncate">{name}</span>
      {warning.evidenceBasis === "ingredient_derived" && (
        <span className="sr-only">({t("allergenMatrix.derivedShort")})</span>
      )}
    </span>
  );
}

// ─── Chip container ─────────────────────────────────────────────────────────

interface AllergenChipsProps {
  /** Allergen warnings to render (from matchProductAllergens) */
  readonly warnings: readonly AllergenWarning[];
}

/**
 * Renders compact allergen warning chips for product cards.
 *
 * - Red chips for "contains" allergens
 * - Amber chips for "may contain traces"
 * - Max 3 visible + "+N more" overflow badge
 * - Returns null when no warnings
 */
export function AllergenChips({ warnings }: AllergenChipsProps) {
  const { t } = useTranslation();

  if (warnings.length === 0) return null;

  const visible = warnings.slice(0, MAX_VISIBLE);
  const overflow = warnings.length - MAX_VISIBLE;

  return (
    <output
      className="flex flex-wrap items-center gap-1"
      data-testid="allergen-chips"
      aria-label={t("common.allergenWarnings", { count: warnings.length })}
    >
      {visible.map((w) => (
        <AllergenChip key={`${w.tag}-${w.type}`} warning={w} />
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center rounded-full border border-transparent bg-surface-muted/95 px-1.5 py-0.5 text-xxs font-medium text-foreground-muted shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[box-shadow,background-color,color] motion-reduce:transition-none"
          title={warnings
            .slice(MAX_VISIBLE)
            .map((w) => t(w.labelKey))
            .join(", ")}
          data-testid="allergen-overflow"
        >
          +{overflow}
        </span>
      )}
    </output>
  );
}
