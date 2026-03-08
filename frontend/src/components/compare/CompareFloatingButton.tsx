"use client";

// ─── CompareFloatingButton — FAB showing compare selection count ────────────
// Appears when ≥1 product is selected. Click navigates to /app/compare.
// Animates in/out with scale + slide transition.

import { useTranslation } from "@/lib/i18n";
import { useCompareStore } from "@/stores/compare-store";
import { Scale, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function CompareFloatingButton() {
  const { t } = useTranslation();
  const count = useCompareStore((s) => s.count());
  const getIds = useCompareStore((s) => s.getIds);
  const clear = useCompareStore((s) => s.clear);
  const router = useRouter();

  if (count < 1) return null;

  function handleCompare() {
    const ids = getIds();
    router.push(`/app/compare?ids=${ids.join(",")}`);
  }

  const canCompare = count >= 2;

  return (
    <div
      className="fixed bottom-20 right-4 z-50 flex items-center gap-2 lg:hidden animate-slide-in-up"
      data-testid="compare-floating-badge"
    >
      {/* Clear button */}
      <button
        type="button"
        onClick={clear}
        className="touch-target flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted text-foreground-secondary shadow-md transition-colors hover:bg-surface-subtle"
        title={t("compare.clearSelection")}
      >
        <X size={18} aria-hidden="true" />
      </button>

      {/* Compare button */}
      <button
        type="button"
        onClick={handleCompare}
        disabled={!canCompare}
        className={`flex items-center gap-2 rounded-full px-5 py-3 font-medium shadow-lg transition-transform ${
          canCompare
            ? "bg-brand text-white hover:scale-105 hover:bg-brand-subtle active:scale-95"
            : "bg-brand/60 text-white/80 cursor-default"
        }`}
        aria-label={t("compare.compareCount", { count })}
      >
        <span className="flex items-center justify-center">
          <Scale size={20} aria-hidden="true" />
        </span>
        {t("compare.compareCount", { count })}
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
          {count}
        </span>
      </button>
    </div>
  );
}
