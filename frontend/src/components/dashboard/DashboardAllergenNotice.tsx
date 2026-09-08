"use client";

import { ALLERGEN_TAGS } from "@/lib/constants";
import type { SavedAllergenMatches } from "@/lib/evidence/home";
import { useTranslation } from "@/lib/i18n";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import styles from "./DashboardAllergenNotice.module.css";

/** This is a projection of Home's same owner-scoped response, never a second RPC. */
export function DashboardAllergenNotice({ matches, stale = false, refreshing = false }: Readonly<{
  matches: SavedAllergenMatches; stale?: boolean; refreshing?: boolean;
}>) {
  const { t } = useTranslation();
  const hasMatches = matches.state === "checked" && (matches.count ?? 0) > 0;
  const unavailable = stale || matches.state === "preferences_unavailable";
  if (matches.state === "not_configured" && !unavailable) return null;
  if (!hasMatches) {
    return <p className={styles.pending} role="status" data-testid="dashboard-allergen-status">
      {t(unavailable ? "homeEvidence.allergenUnavailable" : refreshing ? "dashboard.home.allergenLoading" : "homeEvidence.noMatchingEvidence")}
    </p>;
  }
  const label = (tag: string) => {
    const known = ALLERGEN_TAGS.find((entry) => entry.tag === tag);
    return known ? t(known.labelKey) : tag;
  };
  return <aside className={styles.notice} aria-label={t("dashboard.home.allergenTitle")} data-testid="dashboard-allergen-notice">
    <AlertTriangle className={styles.icon} size={20} aria-hidden="true" />
    <div className={styles.content}>
      <div role="alert">
        <h2 className={styles.title}>{t("dashboard.home.allergenTitle")}</h2>
        <p className={styles.message}>{t("homeEvidence.matchCount", { count: matches.count ?? 0 })}</p>
        <p className={styles.scope}>{t("homeEvidence.allergenScope")}</p>
      </div>
      {unavailable && <p className={styles.message} role="status">{t("homeEvidence.allergenUnavailable")}</p>}
      {refreshing && <p className={styles.scope} role="status">{t("dashboard.home.allergenLoading")}</p>}
      <details className={styles.details}>
        <summary>{t("homeEvidence.showMatches")}</summary>
        <p className={styles.scope}>{t("homeEvidence.matchPreview", { shown: matches.products.length, count: matches.count ?? 0 })}</p>
        <ul className={styles.matchList}>
          {matches.products.map((entry) => <li key={entry.product_id}>
            <Link href={`/app/product/${entry.product_id}`} className={styles.action}>{entry.product?.product_name ?? t("homeEvidence.productUnavailable", { id: entry.product_id })}</Link>
            <span className={styles.scope}>{entry.matches.map((match) => `${label(match.allergen)} (${t(match.kind === "contains" ? "homeEvidence.contains" : "homeEvidence.traces")})`).join(", ")}</span>
          </li>)}
        </ul>
        <p className={styles.scope}>{t(matches.includes_traces ? "homeEvidence.tracesIncluded" : "homeEvidence.tracesExcluded")}</p>
      </details>
      <div className={styles.actions}>
        <Link href="/app/lists" prefetch={false} className={styles.action}>{t("dashboard.home.allergenReview")}<ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </div>
  </aside>;
}
