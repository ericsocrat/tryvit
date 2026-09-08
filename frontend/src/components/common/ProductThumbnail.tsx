"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

// ─── Size presets for different contexts ────────────────────────────────────

const SIZE_PRESETS = {
  /** Search result list row (48 × 48) */
  sm: { container: "h-12 w-12", px: 48 },
  /** Grid card (64 × 64) */
  md: { container: "h-16 w-16", px: 64 },
  /** Large card (80 × 80) */
  lg: { container: "h-20 w-20", px: 80 },
} as const;

type ThumbnailSize = keyof typeof SIZE_PRESETS;

interface ProductThumbnailProps {
  /** Primary product image URL (nullable — falls back to a neutral monogram) */
  readonly imageUrl: string | null | undefined;
  /** Product name (used for alt text) */
  readonly productName: string;
  /** Category slug for fallback icon (e.g. "dairy", "chips-pl") */
  readonly categorySlug?: string;
  /** Emoji fallback when no Lucide category icon exists */
  readonly categoryIcon?: string;
  /** Thumbnail size preset */
  readonly size?: ThumbnailSize;
}

/**
 * Compact product image thumbnail for cards and list rows.
 *
 * Missing or broken photos use a neutral monogram, not a fabricated product image.
 * Uses Next.js Image for optimization (lazy loading, WebP, srcset).
 */
export function ProductThumbnail({
  imageUrl,
  productName,
  size = "sm",
}: ProductThumbnailProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { t } = useTranslation();
  const preset = SIZE_PRESETS[size];
  const monogram = productName.match(/[\p{L}\p{N}]/u)?.[0]?.toLocaleUpperCase() ?? "?";

  const showImage = imageUrl && imageUrl !== failedSrc;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-surface-muted ${preset.container}`}
      data-testid="product-thumbnail"
    >
      {showImage ? (
        <Image
          src={imageUrl}
          alt={productName}
          width={preset.px}
          height={preset.px}
          className="h-full w-full object-cover"
          sizes={`${preset.px}px`}
          onError={() => setFailedSrc(imageUrl)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-foreground-muted"
          role="img"
          aria-label={`${productName} — ${t("evidenceUi.photoUnavailable")}`}
        >
          <span className="select-none text-lg" aria-hidden="true">{monogram}</span>
        </span>
      )}
    </div>
  );
}
