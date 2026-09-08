"use client";

import { useTranslation } from "@/lib/i18n";
import type { HomeReadModel, HomeProductEntry } from "@/lib/evidence/home";
import { ArrowRight, History } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import styles from "./DashboardProducts.module.css";

const MAX_ITEMS = 5;

interface RecentlyViewedProps {
  products: HomeReadModel["recently_viewed"];
}

/** Retained for consumers of the compact relative-time helper. */
export function relativeTimeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

/** Shared row keeps saved and recently opened products equally inspectable. */
export function DashboardProductRow({
  product,
  detail,
  testId,
}: Readonly<{ product: HomeProductEntry; detail?: ReactNode; testId: string }>) {
  const { t } = useTranslation();
  const model = product.product;
  const name = model?.product_name ?? t("homeEvidence.productUnavailable", { id: product.product_id });
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageUrl = model?.image?.url !== failedImage ? model?.image?.url : null;
  const monogram = name.match(/[\p{L}\p{N}]/u)?.[0].toLocaleUpperCase() ?? "·";

  return (
    <Link href={`/app/product/${product.product_id}`} prefetch={false} className={styles.productRow} data-testid={testId}>
      <span className={styles.thumbnail} aria-hidden="true">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            width={44}
            height={52}
            className={styles.productImage}
            loading="lazy"
            onError={() => setFailedImage(imageUrl)}
          />
        ) : <span className={styles.monogram}>{monogram}</span>}
      </span>
      <span className={styles.productCopy}>
        <span className={styles.productName}>{name}</span>
        <span className={styles.productMeta}>
          {model?.brand ? <span>{model.brand}</span> : null}
          {detail}
        </span>
        <span className={styles.rowEvidence}>{model ? t(`evidenceUi.summary.${model.evidence.state}`) : t("homeEvidence.recordUnavailable")}</span>
        {model?.is_deprecated ? <span className={styles.rowEvidence}>{t("homeEvidence.archived")}</span> : null}
      </span>
      <ArrowRight size={15} aria-hidden="true" className={styles.rowArrow} />
    </Link>
  );
}

export function RecentlyViewed({ products }: Readonly<RecentlyViewedProps>) {
  const { t, language } = useTranslation();
  const [observedAt] = useState(() => Date.now());
  const items = products.slice(0, MAX_ITEMS);
  const dateFormatter = new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" });

  return (
    <section className={styles.recent} data-testid="recently-viewed-compact" aria-labelledby="dashboard-recent-title">
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="dashboard-recent-title">{t("dashboard.recentlyViewedCompact")}</h2>
          <p>{t("dashboard.home.recentIntro")}</p>
        </div>
        <Link href="/app/search" prefetch={false} className={styles.textLink}>
          {t("dashboard.home.searchProducts")}<ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {items.length > 0 ? (
        <>
          <ul className={styles.productList}>
            {items.map((product) => {
              const date = new Date(product.viewed_at);
              const dateLabel = Number.isNaN(date.getTime()) || date.getTime() > observedAt ? null : dateFormatter.format(date);
              return (
                <li key={product.product_id}>
                  <DashboardProductRow
                    product={product}
                    testId="recently-viewed-item"
                    detail={dateLabel ? <time dateTime={product.viewed_at} aria-label={t("dashboard.home.viewedOn", { date: dateLabel })}>{dateLabel}</time> : null}
                  />
                </li>
              );
            })}
          </ul>
          <p className={styles.evidenceNote}>{t("dashboard.home.productEvidenceNote")}</p>
        </>
      ) : (
        <div className={styles.emptyRecent}>
          <History size={25} aria-hidden="true" />
          <h3>{t("dashboard.home.recentEmptyTitle")}</h3>
          <p>{t("dashboard.home.recentEmptyDescription")}</p>
        </div>
      )}
    </section>
  );
}
