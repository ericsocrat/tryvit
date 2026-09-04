"use client";

import { useTranslation } from "@/lib/i18n";
import type { DashboardData } from "@/lib/types";
import { ArrowRight, Heart, Layers } from "lucide-react";
import Link from "next/link";
import { DashboardProductRow } from "./RecentlyViewed";
import styles from "./DashboardProducts.module.css";

interface DashboardCollectionsProps {
  favorites: DashboardData["favorites_preview"];
  stats: Pick<DashboardData["stats"], "favorites_count" | "lists_count">;
}

export function DashboardCollections({ favorites, stats }: Readonly<DashboardCollectionsProps>) {
  const { t } = useTranslation();
  const items = favorites.slice(0, 3);

  return (
    <section className={styles.collections} aria-labelledby="dashboard-collections-title" data-testid="dashboard-collections">
      <div className={styles.collectionHeading}>
        <Layers size={21} aria-hidden="true" />
        <h2 id="dashboard-collections-title">{t("dashboard.home.collectionsTitle")}</h2>
      </div>
      <p className={styles.collectionIntro}>{t("dashboard.home.collectionsIntro")}</p>
      <div className={styles.collectionCounts}>
        <span>{t("dashboard.home.savedFavorites", { count: stats.favorites_count })}</span>
        <span>{t("dashboard.home.savedLists", { count: stats.lists_count })}</span>
      </div>

      {items.length > 0 ? (
        <>
          <div className={styles.favoritesHeading}>
            <h3>{t("dashboard.favorites")}</h3>
            <Heart size={15} aria-hidden="true" />
          </div>
          <p className={styles.scoreCaption}>{t("dashboard.home.productScoreCaption")}</p>
          <ul className={styles.productList}>
            {items.map((product) => (
              <li key={product.product_id}>
                <DashboardProductRow product={product} testId="dashboard-favorite-item" />
              </li>
            ))}
          </ul>
        </>
      ) : stats.favorites_count > 0 ? (
        <p className={styles.previewUnavailable}>{t("dashboard.home.favoritesPreviewUnavailable")}</p>
      ) : (
        <div className={styles.emptyFavorites}>
          <Heart size={24} aria-hidden="true" />
          <h3>{t("dashboard.home.favoritesEmptyTitle")}</h3>
          <p>{t("dashboard.home.favoritesEmptyDescription")}</p>
        </div>
      )}

      <div className={styles.collectionFooter}>
        <Link href="/app/lists" prefetch={false} className={styles.collectionLink}>
          {t("dashboard.home.openCollections")}<ArrowRight size={17} aria-hidden="true" />
        </Link>
        <div className={styles.collectionTools}>
          <Link href="/app/compare" prefetch={false} className={styles.textLink}>{t("dashboard.home.compare")}</Link>
          <Link href="/app/compare/saved" prefetch={false} className={styles.textLink}>{t("dashboard.home.savedComparisons")}</Link>
        </div>
      </div>
    </section>
  );
}
