"use client";

import { CategoryIcon } from "@/components/common/CategoryIcon";
import { useTranslation } from "@/lib/i18n";
import { toTryVitScore } from "@/lib/score-utils";
import type { RecentlyViewedProduct } from "@/lib/types";
import { ArrowRight, History } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import styles from "./DashboardProducts.module.css";

const MAX_ITEMS = 5;

interface RecentlyViewedProps {
  products: RecentlyViewedProduct[];
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

type DashboardProduct = Pick<
  RecentlyViewedProduct,
  "product_id" | "product_name" | "brand" | "category" | "unhealthiness_score" | "image_thumb_url"
>;

/** Shared row keeps saved and recently opened products equally inspectable. */
export function DashboardProductRow({
  product,
  detail,
  testId,
}: Readonly<{ product: DashboardProduct; detail?: ReactNode; testId: string }>) {
  const { t } = useTranslation();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const rawScore = product.unhealthiness_score;
  const score = rawScore !== null && Number.isFinite(rawScore) && rawScore >= 1 && rawScore <= 100
    ? toTryVitScore(rawScore)
    : null;
  const imageUrl = product.image_thumb_url !== failedImage ? product.image_thumb_url : null;
  const categorySlug = product.category.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");

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
        ) : <CategoryIcon slug={categorySlug} size="lg" />}
      </span>
      <span className={styles.productCopy}>
        <span className={styles.productName}>{product.product_name}</span>
        <span className={styles.productMeta}>
          {product.brand ? <span>{product.brand}</span> : null}
          {detail}
        </span>
      </span>
      <span className={styles.productScore}>
        {score === null ? (
          <span className={styles.unavailable}>{t("dashboard.home.scoreUnavailable")}</span>
        ) : (
          <>
            <span className="sr-only">{t("dashboard.home.productScore", { score })}</span>
            <span aria-hidden="true" className={styles.scoreValue}>{score}<span>/100</span></span>
          </>
        )}
      </span>
      <ArrowRight size={15} aria-hidden="true" className={styles.rowArrow} />
    </Link>
  );
}

export function RecentlyViewed({ products }: Readonly<RecentlyViewedProps>) {
  const { t, language } = useTranslation();
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
          <p className={styles.scoreCaption}>{t("dashboard.home.productScoreCaption")}</p>
          <ul className={styles.productList}>
            {items.map((product) => {
              const date = new Date(product.viewed_at);
              const dateLabel = Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
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
