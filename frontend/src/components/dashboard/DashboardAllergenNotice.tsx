"use client";

import { getDashboardInsights } from "@/lib/api";
import { ALLERGEN_TAGS } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import styles from "./DashboardAllergenNotice.module.css";

/** Saved Favorites matches only; this RPC does not assess traces or suitability. */
export function DashboardAllergenNotice() {
  const [supabase] = useState(createClient);
  const { t } = useTranslation();
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: queryKeys.dashboardInsights,
    queryFn: async () => {
      const result = await getDashboardInsights(supabase);
      if (!result.ok) throw new Error(result.error.message);

      const alerts = result.data?.allergen_alerts;
      // An incomplete response is unavailable evidence, not an empty check.
      // The existing RPC can return products: null for a successful zero count.
      if (
        !alerts ||
        !Number.isInteger(alerts.count) ||
        alerts.count < 0 ||
        (alerts.count > 0 &&
          (!Array.isArray(alerts.products) ||
            alerts.products.length === 0 ||
            alerts.products.some(
              (product) =>
                !product ||
                typeof product.allergen !== "string" ||
                product.allergen.trim().length === 0,
            )))
      ) {
        throw new Error("Saved allergen matches are unavailable");
      }

      // Keep the complete response in the existing shared insights cache.
      return result.data;
    },
    staleTime: staleTimes.dashboardInsights,
    // Settings can change saved allergens without invalidating this shared cache.
    refetchOnMount: "always",
  });

  if (isLoading || (isFetching && !data?.allergen_alerts.count)) {
    return (
      <div className={styles.pending} role="status" data-testid="dashboard-allergen-loading">
        {t("dashboard.home.allergenLoading")}
      </div>
    );
  }

  const alerts = data?.allergen_alerts;
  const hasMatches = Boolean(alerts && alerts.count > 0);
  if (!hasMatches && !isError) return null;

  const allergens = hasMatches
    ? [...new Set(alerts?.products.map((product) => product.allergen.replace(/^en:/, "").trim()))]
        .map((tag) => {
          const known = ALLERGEN_TAGS.find((allergen) => allergen.tag === tag);
          return known ? t(known.labelKey) : tag;
        })
        .join(", ")
    : "";

  return (
    <aside
      className={styles.notice}
      aria-label={t("dashboard.home.allergenTitle")}
      data-testid="dashboard-allergen-notice"
    >
      <AlertTriangle className={styles.icon} size={20} aria-hidden="true" />
      <div className={styles.content}>
        {hasMatches && (
          <div role="alert">
            <h2 className={styles.title}>{t("dashboard.home.allergenTitle")}</h2>
            <p className={styles.message}>
              {t("dashboard.home.allergenMatches", { count: alerts?.count ?? 0, allergens })}
            </p>
            <p className={styles.scope}>{t("dashboard.home.allergenScope")}</p>
          </div>
        )}
        {isError && (
          <p className={styles.message} role="status">
            {t("dashboard.home.allergenUnavailable")}
          </p>
        )}
        {isFetching && (
          <p className={styles.scope} role="status">
            {t("dashboard.home.allergenLoading")}
          </p>
        )}
        <div className={styles.actions}>
          <Link href="/app/lists" prefetch={false} className={styles.action}>
            {t("dashboard.home.allergenReview")}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          {isError && (
            <button
              type="button"
              className={styles.action}
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw size={15} aria-hidden="true" />
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
