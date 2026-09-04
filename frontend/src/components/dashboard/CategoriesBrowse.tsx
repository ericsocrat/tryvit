"use client";

import { CategoryIcon } from "@/components/common/CategoryIcon";
import { Skeleton } from "@/components/common/Skeleton";
import { getCategoryOverview } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import styles from "./DashboardWorkspace.module.css";

export function CategoriesBrowse() {
  const [supabase] = useState(createClient);
  const { t } = useTranslation();
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: queryKeys.categoryOverview,
    queryFn: async () => {
      const result = await getCategoryOverview(supabase);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.categoryOverview,
  });
  return (
    <section aria-labelledby="dashboard-categories-title">
      <div className={styles.categoriesHeader}>
        <h2 id="dashboard-categories-title">{t("dashboard.categoriesTitle")}</h2>
        <Link href="/app/categories" prefetch={false} className={styles.textLink}>{t("dashboard.viewAll")}<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      {isLoading && <div className={styles.categories} role="status" aria-label={t("common.loading")} aria-busy="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rect" height={104} />)}</div>}
      {isError && <div className={styles.sectionMessage} role="status"><p>{t("dashboard.home.categoriesError")}</p><button type="button" className={styles.retry} disabled={isFetching} onClick={() => void refetch()}>{t(isFetching ? "common.loading" : "common.retry")}</button></div>}
      {!isLoading && !isError && data?.length === 0 && <p className={styles.sectionMessage}>{t("dashboard.home.categoriesEmpty")}</p>}
      {data && data.length > 0 && <ul className={styles.categories} aria-label={t("dashboard.categoriesTitle")}>
        {data.slice(0, 6).map((category) => <li key={category.category}><Link href={`/app/categories/${category.slug}`} prefetch={false} className={styles.category}><CategoryIcon slug={category.slug} size="lg" /><span>{category.display_name}</span></Link></li>)}
      </ul>}
    </section>
  );
}
