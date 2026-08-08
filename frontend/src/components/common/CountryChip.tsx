// ─── CountryChip: inline country indicator with SVG micro-flag ──────────────
// Shows SVG flag + country code (or full name with showLabel).
// Reflects reality from API responses, not local state.

"use client";

import { COUNTRIES } from "@/lib/country-config";
import { useTranslation } from "@/lib/i18n";
import type { ReactElement } from "react";

interface FlagProps {
  size: number;
}
type FlagComponent = (props: FlagProps) => ReactElement;
type KnownCountryCode = (typeof COUNTRIES)[number]["code"];

// ─── Types ──────────────────────────────────────────────────────────────────

interface CountryChipProps {
  /** ISO 3166-1 alpha-2 country code. Null → render nothing (unless nullLabel provided). */
  country: string | null;
  /** Show full country name instead of 2-letter code. */
  showLabel?: boolean;
  /** Badge size variant. */
  size?: "sm" | "md";
  /** Label to show when country is null. If omitted, null renders nothing. */
  nullLabel?: string;
  className?: string;
}

// ─── Inline SVG Flags ───────────────────────────────────────────────────────
// Simplified flag SVGs (<500 bytes each) for crisp rendering at small sizes.

function PolishFlag({ size }: FlagProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 12"
      aria-hidden="true"
      className="shrink-0 rounded-[2px]"
    >
      <rect width="16" height="6" fill="#fff" />
      <rect y="6" width="16" height="6" fill="#DC143C" />
    </svg>
  );
}

function GermanFlag({ size }: FlagProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 12"
      aria-hidden="true"
      className="shrink-0 rounded-[2px]"
    >
      <rect width="16" height="4" fill="#000" />
      <rect y="4" width="16" height="4" fill="#DD0000" />
      <rect y="8" width="16" height="4" fill="#FFCC00" />
    </svg>
  );
}

function FallbackFlag({ size }: FlagProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 12"
      aria-hidden="true"
      className="shrink-0 rounded-[2px]"
    >
      <rect width="16" height="12" fill="#9CA3AF" rx="1" />
      <text
        x="8"
        y="8"
        textAnchor="middle"
        fontSize="6"
        fill="#fff"
        fontWeight="bold"
      >
        ?
      </text>
    </svg>
  );
}

const FLAG_COMPONENTS: Partial<Record<KnownCountryCode, FlagComponent>> = {
  PL: PolishFlag,
  DE: GermanFlag,
};

// ─── Size config ────────────────────────────────────────────────────────────

const SIZE_CONFIG = {
  sm: { flag: 14, text: "text-xs", px: "px-1.5 py-0.5", gap: "gap-1" },
  md: { flag: 16, text: "text-sm", px: "px-2.5 py-1", gap: "gap-1.5" },
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

export function CountryChip({
  country,
  showLabel = false,
  size = "md",
  nullLabel,
  className = "",
}: Readonly<CountryChipProps>) {
  const { t } = useTranslation();

  if (!country && !nullLabel) return null;

  if (!country) {
    const cfg = SIZE_CONFIG[size];
    return (
      <span
        role="img"
        aria-label={nullLabel ?? ""}
        className={`inline-flex items-center ${cfg.gap} rounded-full border border-default bg-surface-muted/95 ${cfg.px} ${cfg.text} font-medium text-foreground-muted shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[box-shadow,background-color,color] motion-reduce:transition-none ${className}`}
      >
        <FallbackFlag size={cfg.flag} />
        <span>{nullLabel}</span>
      </span>
    );
  }

  const meta = COUNTRIES.find((c) => c.code === country);
  const name = meta?.name ?? country;
  const FlagIcon = FLAG_COMPONENTS[country as KnownCountryCode] ?? FallbackFlag;
  const cfg = SIZE_CONFIG[size];
  const displayText = showLabel ? name : country;

  return (
    <span
      role="img"
      aria-label={t("common.productFrom", { country: name })}
      className={`inline-flex items-center ${cfg.gap} rounded-full border border-default bg-surface-subtle/95 ${cfg.px} ${cfg.text} font-medium text-foreground-secondary shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[box-shadow,background-color,color] motion-reduce:transition-none ${className}`}
    >
      <FlagIcon size={cfg.flag} />
      <span>{displayText}</span>
    </span>
  );
}
