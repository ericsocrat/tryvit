"use client";

import { ProductThumbnail } from "@/components/common/ProductThumbnail";
import { useTranslation } from "@/lib/i18n";
import type { ProductReadModel } from "@/lib/evidence/product-read-model";
import type { ProductProvenance, ScoreBand } from "@/lib/types";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./ProductRegisterCard.module.css";

interface EvidenceState {
  readonly data?: ProductProvenance;
  readonly isLoading?: boolean;
  readonly error?: Error | null;
}

export interface ProductRegisterCardProps {
  readonly productId: number;
  readonly href: string;
  readonly name: string;
  readonly brand?: string | null;
  readonly category?: string | null;
  readonly categorySlug?: string;
  readonly categoryIcon?: string;
  readonly imageUrl?: string | null;
  readonly readModel?: ProductReadModel;
  /** @deprecated Legacy values are accepted during migration but never displayed. */
  readonly score?: number | null;
  /** @deprecated Not an evidence-first interpretation. */
  readonly scoreBand?: ScoreBand;
  readonly evidence?: EvidenceState;
  readonly detail?: string;
  readonly meta?: ReactNode;
  /** @deprecated Unattributed legacy grading badges are not rendered. */
  readonly badges?: ReactNode;
  readonly actions?: ReactNode;
  readonly variant?: "grid" | "list";
  readonly muted?: boolean;
  readonly highlight?: string;
}

/** One identity/evidence card, with no universal score or implicit winner. */
export function ProductRegisterCard({
  productId, href, name, brand, category, categorySlug, categoryIcon, imageUrl,
  readModel, evidence, detail, meta, actions, variant = "list", muted = false, highlight,
}: ProductRegisterCardProps) {
  const { t } = useTranslation();
  const model = readModel?.product_id === productId ? readModel : undefined;
  const displayName = model?.product_name ?? name;
  const displayBrand = model ? model.brand : brand;
  const displayCategory = model?.category ?? category;
  const disposition = evidence?.isLoading ? "loading" : evidence?.error ? "unavailable" : model?.evidence.state ?? "legacy_unverified";
  const message = disposition === "loading" ? t("trust.evidence.loading")
    : disposition === "unavailable" ? t("trust.evidence.unavailableTitle")
      : t(`evidenceUi.summary.${disposition}`);
  return (
    <li className={[styles.registerCard, styles[variant], muted ? styles.muted : ""].filter(Boolean).join(" ")}
      data-evidence-disposition={disposition} data-testid="product-register-card">
      <Link href={href} className={styles.link}>
        <div className={styles.media}>
          <ProductThumbnail imageUrl={model ? model.image?.url : imageUrl} productName={displayName}
            categorySlug={categorySlug} categoryIcon={categoryIcon} size={variant === "grid" ? "md" : "sm"} />
        </div>
        <div className={styles.identity}>
          {displayCategory ? <p className={styles.eyebrow}>{displayCategory}</p> : null}
          <p className={styles.name}>{displayName}</p>
          {displayBrand ? <p className={styles.brand}>{displayBrand}</p> : null}
          {detail ? <p className={styles.detail}>{detail}</p> : null}
          <span className={styles.evidence}>{message}</span>
          {highlight ? <span className={styles.highlight}>{highlight}</span> : null}
        </div>
      </Link>
      {model && meta ? <div className={styles.support}><div className={styles.meta}>{meta}</div></div> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </li>
  );
}

export type { EvidenceState as ProductRegisterEvidenceState };
