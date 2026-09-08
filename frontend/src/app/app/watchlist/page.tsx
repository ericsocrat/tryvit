"use client";

import { Button } from "@/components/common/Button";
import { EmptyStateIllustration } from "@/components/common/EmptyStateIllustration";
import { WatchlistSkeleton } from "@/components/common/skeletons";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import { ProductRegisterCard } from "@/components/product/ProductRegisterCard";
import { unwatchProduct } from "@/lib/api";
import { collectionQueryKeys, getWatchedProducts } from "@/lib/evidence/collections";
import { useTranslation } from "@/lib/i18n";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import styles from "./watchlist.module.css";

export default function WatchlistPage() {
  const { t, language } = useTranslation();
  const [page, setPage] = useState(1);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: collectionQueryKeys.watched(page, language),
    queryFn: async () => {
      const result = await getWatchedProducts(createClient(), page, language);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });
  const removal = useMutation({
    mutationFn: async (productId: number) => {
      const result = await unwatchProduct(createClient(), productId);
      if (!result.ok) throw new Error(result.error.message);
      if (result.data.success !== true || result.data.watching !== false) throw new Error("Watch removal was not confirmed");
      return result.data;
    },
    onSuccess: (_data, productId) => {
      void client.invalidateQueries({ queryKey: queryKeys.watchlist() });
      void client.invalidateQueries({ queryKey: queryKeys.isWatching(productId) });
    },
  });
  const formatter = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" });

  return <AppPage className={styles.page}>
    <AppPageHeader eyebrow={t("nav.saved")} title={t("evidenceUi.monitoringTitle")} description={t("evidenceUi.monitoringDescription")} />
    {query.isPending ? <div data-testid="watchlist-loading"><WatchlistSkeleton /></div> : null}
    {query.isError ? <section role="alert" className={styles.error} data-testid="watchlist-error"><p>{t("watchlist.loadError")}</p><Button variant="secondary" onClick={() => void query.refetch()}>{t("common.retry")}</Button></section> : null}
    {removal.isError ? <p role="alert" className={styles.error}>{t("evidenceUi.watchRemovalFailed")}</p> : null}
    {query.data && !query.isError ? <>
      {query.data.items.length === 0 ? <EmptyStateIllustration type="no-favorites" titleKey={query.data.total > 0 ? "findUi.emptyPage" : "watchlist.emptyTitle"} descriptionKey="evidenceUi.monitoringDescription" action={query.data.total > 0 ? { labelKey: "findUi.firstPage", onClick: () => setPage(1) } : { labelKey: "nav.find", href: "/app/search" }} /> : <ul className={styles.items}>
        {query.data.items.map((item) => {
          const product = item.product;
          const date = new Date(item.watched_since);
          const watched = Number.isNaN(date.getTime()) ? t("evidenceUi.dateUnavailable") : formatter.format(date);
          const name = product?.product_name ?? t("evidenceUi.productReference", { id: item.product_id });
          return <ProductRegisterCard key={item.watch_id} productId={item.product_id} href={`/app/product/${item.product_id}`} name={name} brand={product?.brand} category={product?.category} readModel={product ?? undefined} detail={t("evidenceUi.watchedSince", { date: watched })} highlight={product ? (product.is_deprecated ? t("evidenceUi.archivedProduct") : undefined) : t("evidenceUi.collectionUnavailable")}
            actions={<Button variant="ghost" disabled={removal.isPending} onClick={() => removal.mutate(item.product_id)} aria-label={`${t("watchlist.unwatchButton")} ${name}`}>{t("watchlist.unwatchButton")}</Button>} />;
        })}
      </ul>}
      {query.data.total_pages > 1 ? <nav className={styles.pagination} aria-label={t("evidenceUi.savedPagination")}><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t("common.prev")}</Button><span>{t("findUi.page", { page, pages: query.data.total_pages })}</span><Button variant="secondary" disabled={page >= query.data.total_pages} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</Button></nav> : null}
    </> : null}
  </AppPage>;
}
