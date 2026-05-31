"use client";

import { useTranslation } from "@/lib/i18n";
import { Printer } from "lucide-react";

interface PrintButtonProps {
  /** Optional additional classes */
  readonly className?: string;
}

/**
 * Subtle print button that triggers window.print().
 * Hidden in print mode via the `no-print` class.
 */
export function PrintButton({ className = "" }: PrintButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => globalThis.print()}
      className={`no-print inline-flex items-center gap-1.5 rounded-xl border border-transparent bg-surface/95 px-3 py-1.5 text-sm font-medium text-foreground-secondary shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[background-color,box-shadow,color] motion-reduce:transition-none hover:bg-surface-subtle hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/30 ${className}`}
      aria-label={t("print.printPage")}
    >
      <Printer size={16} aria-hidden="true" />{" "}
      <span className="hidden sm:inline">{t("print.button")}</span>
    </button>
  );
}
