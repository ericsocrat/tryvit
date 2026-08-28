"use client";

// ─── Saved Comparisons — list of user's saved comparisons ───────────────────
// URL: /app/compare/saved

import { EmptyState } from "@/components/common/EmptyState";
import { EmptyStateIllustration } from "@/components/common/EmptyStateIllustration";
import { SavedItemsSkeleton } from "@/components/common/skeletons";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useDeleteComparison, useSavedComparisons } from "@/hooks/use-compare";
import { useTranslation } from "@/lib/i18n";
import type { SavedComparison } from "@/lib/types";
import { Check, Link2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import styles from "@/app/app/compare/compare.module.css";

export default function SavedComparisonsPage() {
  const { data, isLoading, error, refetch } = useSavedComparisons();
  const removeMutation = useDeleteComparison();
  const { t } = useTranslation();

  return (
    <AppPage className={styles.page}>
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { labelKey: "nav.home", href: "/app" },
          { labelKey: "compare.title", href: "/app/compare" },
          { labelKey: "compare.savedComparisons" },
        ]}
      />

      <AppPageHeader
        eyebrow={t("compare.title")}
        title={t("compare.savedComparisons")}
        description={t("compare.noSavedDescription")}
      />

      {removeMutation.error ? (
        <p className={styles.mutationError} role="alert">
          {t("compare.loadFailed")}
        </p>
      ) : null}

      {/* Loading */}
      {isLoading ? <SavedItemsSkeleton /> : null}

      {/* Error */}
      {error ? (
        <EmptyState
          variant="error"
          titleKey="compare.loadFailed"
          action={{ labelKey: "common.retry", onClick: () => void refetch() }}
        />
      ) : null}

      {/* Empty state */}
      {data?.comparisons.length === 0 ? (
        <EmptyStateIllustration
          type="no-comparisons"
          titleKey="compare.noSaved"
          descriptionKey="compare.noSavedDescription"
          action={{ labelKey: "compare.findProducts", href: "/app/search" }}
        />
      ) : null}

      {/* Comparisons list */}
      {data && data.comparisons.length > 0 ? (
        <ul className={styles.savedList}>
          {data.comparisons.map((comp) => (
            <ComparisonCard
              key={comp.comparison_id}
              comparison={comp}
              onDelete={() => removeMutation.mutate(comp.comparison_id)}
              isDeleting={removeMutation.isPending}
            />
          ))}
        </ul>
      ) : null}
    </AppPage>
  );
}

function ComparisonCard({
  comparison,
  onDelete,
  isDeleting,
}: Readonly<{
  comparison: SavedComparison;
  onDelete: () => void;
  isDeleting: boolean;
}>) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const ids = comparison.product_ids.join(",");
  const date = new Date(comparison.created_at).toLocaleDateString();

  return (
    <li className={styles.savedRecord}>
      <Link href={`/app/compare?ids=${ids}`} className={styles.savedLink}>
        <p className={styles.savedTitle}>
          {comparison.title ??
            t("compare.compareProducts", {
              count: comparison.product_ids.length,
            })}
        </p>
        <div className={styles.productNames}>
          {comparison.product_names.map((name) => (
            <span key={name} className={styles.productName}>
              {name}
            </span>
          ))}
        </div>
        <p className={styles.savedMeta}>{date}</p>
      </Link>

      <div className={styles.recordActions}>
        {/* Share link */}
        {comparison.share_token && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              const url = `${globalThis.location.origin}/compare/shared/${comparison.share_token}`;
              navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className={`${styles.iconAction} ${copied ? "text-success" : ""}`}
            title={copied ? t("compare.copiedToClipboard") : t("compare.copyShareLink")}
            aria-label={copied ? t("compare.copiedToClipboard") : t("compare.copyShareLink")}
          >
            {copied ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Link2 size={16} aria-hidden="true" />
            )}
          </button>
        )}

        {/* Delete */}
        <button
          type="button"
          disabled={isDeleting}
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          className={`${styles.iconAction} ${styles.danger}`}
          title={t("compare.deleteComparison")}
          aria-label={t("compare.deleteComparison")}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
