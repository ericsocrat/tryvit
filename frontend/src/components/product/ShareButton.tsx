// ─── ShareButton — native share / clipboard fallback ──────────────────────
"use client";

import type { ProvenanceDisposition } from "@/hooks/use-product-provenance";
import { eventBus } from "@/lib/events";
import { useTranslation } from "@/lib/i18n";
import { toTryVitScore } from "@/lib/score-utils";
import { useCallback, useState } from "react";

interface ShareButtonProps {
  readonly productName: string;
  readonly score: number;
  readonly productId: number;
  readonly scoreProvenanceDisposition: ProvenanceDisposition | null;
}

export function ShareButton({
  productName,
  score,
  productId,
  scoreProvenanceDisposition,
}: ShareButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const shareUrl = `${globalThis.location.origin}/app/product/${productId}`;
    const hasConfirmedScore = scoreProvenanceDisposition === "confirmed";
    const displayScore = toTryVitScore(score);
    const shareTitle = hasConfirmedScore
      ? t("product.shareConfirmedTitle", {
          name: productName,
          score: displayScore,
        })
      : t("product.shareNeutralTitle", { name: productName });
    const shareText = hasConfirmedScore
      ? t("product.shareConfirmedText", {
          name: productName,
          score: displayScore,
        })
      : t("product.shareNeutralText", { name: productName });

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        void eventBus.emit({
          type: "product.shared",
          payload: { productId, method: "native" },
        });
        return; // success — native dialog handled it
      } catch (err) {
        // User cancelled — still fall through to clipboard
        if ((err as Error).name === "AbortError") return;
      }
    }

    // Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      void eventBus.emit({
        type: "product.shared",
        payload: { productId, method: "clipboard" },
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context)
    }
  }, [productName, score, productId, scoreProvenanceDisposition, t]);

  return (
    <button
      type="button"
      onClick={handleShare}
      className="touch-target flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-foreground-secondary transition hover:bg-surface-subtle"
      aria-label={t("product.shareProduct")}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
        />
      </svg>
      <span className="hidden sm:inline">
        {copied ? t("product.shareCopied") : t("product.share")}
      </span>
    </button>
  );
}
