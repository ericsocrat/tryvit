"use client";

// ─── Categories overview — grid of category cards ───────────────────────────

import { CategoryIcon } from "@/components/common/CategoryIcon";
import { EmptyState } from "@/components/common/EmptyState";
import { CategoryGridSkeleton } from "@/components/common/skeletons";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { getCategoryOverview } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { toTryVitScore } from "@/lib/score-utils";
import { createClient } from "@/lib/supabase/client";
import type { CategoryOverviewItem } from "@/lib/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import styles from "./categories.module.css";
export default function CategoriesPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.categoryOverview,
    queryFn: async () => {
      const result = await getCategoryOverview(supabase);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.categoryOverview,
  });

  return (
    <AppPage className={styles.page}>
      <Breadcrumbs
        items={[
          { labelKey: "nav.home", href: "/app" },
          { labelKey: "nav.categories" },
        ]}
      />
      <AppPageHeader
        eyebrow={t("nav.categories")}
        title={t("categories.title")}
        register={
          data && data.length > 0 ? (
            <>
              <span>{t("common.items", { count: data.length })}</span>
              {data[0]?.country_code ? (
                <span>{t("common.productFrom", { country: data[0].country_code })}</span>
              ) : null}
              <span>{t("trust.evidence.scoreProvisionalLabel")}</span>
            </>
          ) : undefined
        }
      />

      {isLoading ? <CategoryGridSkeleton /> : null}

      {!isLoading && error ? (
        <EmptyState
          variant="error"
          titleKey="categories.loadFailed"
          action={{
            labelKey: "common.retry",
            onClick: () =>
              queryClient.invalidateQueries({
                queryKey: queryKeys.categoryOverview,
              }),
          }}
        />
      ) : null}

      {!isLoading && !error && data?.length === 0 ? (
        <EmptyState variant="no-data" titleKey="common.noResults" />
      ) : null}

      {!isLoading && !error && data && data.length > 0 ? (
        <div className={styles.categoryGrid}>
          {data.map((cat) => (
            <CategoryCard key={cat.category} category={cat} />
          ))}
        </div>
      ) : null}
    </AppPage>
  );
}

function CategoryCard({
  category,
}: Readonly<{ category: CategoryOverviewItem }>) {
  const { t } = useTranslation();
  const hasAggregateScore = Number.isFinite(category.avg_score);
  const tryVitScore = hasAggregateScore
    ? toTryVitScore(Math.round(category.avg_score))
    : null;

  return (
    <Link className={styles.categoryCard} href={`/app/categories/${category.slug}`}>
      <span className={styles.fold} aria-hidden="true" />
      <span className={styles.categoryIdentity}>
        <CategoryIcon slug={category.slug} size="xl" />
        <span className={styles.categoryCopy}>
          <strong className={styles.categoryName}>{category.display_name}</strong>
          <small>{t("common.products", { count: category.product_count })}</small>
        </span>
      </span>
      <span
        className={styles.aggregateScore}
        aria-label={`${t("categories.avgScore", { score: tryVitScore ?? "—" })} — ${t(
          "trust.evidence.scoreProvisionalLabel",
        )}`}
      >
        <strong>{tryVitScore ?? "—"}</strong>
        <small>{t("trust.evidence.scoreProvisionalLabel")}</small>
      </span>
    </Link>
  );
}
