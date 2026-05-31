"use client";

import { useTranslation } from "@/lib/i18n";

const SIZES = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-4",
  lg: "h-12 w-12 border-4",
} as const;

type LoadingSpinnerSize = keyof typeof SIZES;

interface LoadingSpinnerProps {
  className?: string;
  size?: LoadingSpinnerSize;
}

export function LoadingSpinner({
  className = "",
  size = "md",
}: Readonly<LoadingSpinnerProps>) {
  const { t } = useTranslation();
  return (
    <output
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-surface/95 px-2 py-1 text-foreground-muted shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[box-shadow,background-color,color] motion-reduce:transition-none ${className}`}
      aria-label={t("common.loading")}
    >
      <div
        className={`animate-spin rounded-full border-surface-muted border-t-brand shadow-[0_1px_3px_rgba(15,23,42,0.2)] transition-colors motion-reduce:animate-none ${SIZES[size]}`}
      />
      <span className="sr-only">{t("common.loading")}</span>
    </output>
  );
}
