"use client";

// ─── Compare page — side-by-side product comparison ─────────────────────────
// URL: /app/compare?ids=1,2,3,4
// Works with 2-4 product IDs from URL params.
// Authenticated users can save comparisons and see avoid badges.

import { EmptyState } from "@/components/common/EmptyState";
import { EmptyStateIllustration } from "@/components/common/EmptyStateIllustration";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { PrintButton } from "@/components/common/PrintButton";
import { ComparisonGridSkeleton } from "@/components/common/skeletons";
import { ComparisonGrid } from "@/components/compare/ComparisonGrid";
import { ShareComparison } from "@/components/compare/ShareComparison";
import { ExportButton } from "@/components/export/ExportButton";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductEvidencePanel } from "@/components/trust/ProductEvidencePanel";
import { useAnalytics } from "@/hooks/use-analytics";
import { useCompareProducts } from "@/hooks/use-compare";
import {
  canRecommendFromProvenance,
  getProvenanceDisposition,
  hasUsableProvenanceField,
  useProductProvenanceMap,
} from "@/hooks/use-product-provenance";
import { eventBus } from "@/lib/events";
import type { ExportableProduct } from "@/lib/export";
import { useTranslation } from "@/lib/i18n";
import type { CompareProduct } from "@/lib/types";
import { useCompareStore } from "@/stores/compare-store";
import { AlertTriangle, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import styles from "./compare.module.css";

const EXPORT_FIELD_PROVENANCE = [
  ["product_name", "product_name"],
  ["brand", "brand"],
  ["ean", "ean"],
  ["category", "category"],
  ["unhealthiness_score", "unhealthiness_score"],
  ["nutri_score", "nutri_score_label"],
  ["nova_group", "nova_classification"],
  ["calories", "calories_100g"],
  ["total_fat_g", "fat_100g"],
  ["saturated_fat_g", "saturated_fat_100g"],
  ["sugars_g", "sugars_100g"],
  ["salt_g", "salt_100g"],
  ["protein_g", "protein_100g"],
  ["fibre_g", "fiber_100g"],
  ["allergen_tags", "allergens"],
  ["confidence", "confidence"],
] as const satisfies ReadonlyArray<
  readonly [keyof CompareProduct, string]
>;

function hasConfirmedExportEvidence(
  product: CompareProduct,
  provenance: Parameters<typeof getProvenanceDisposition>[0] | undefined,
): boolean {
  if (!provenance || getProvenanceDisposition(provenance) !== "confirmed") {
    return false;
  }

  return EXPORT_FIELD_PROVENANCE.every(([productField, provenanceField]) => {
    const value = product[productField];
    if (value === null || value === undefined || value === "") return true;
    return hasUsableProvenanceField(provenance, provenanceField, 90);
  });
}

export default function ComparePage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") ?? "";
  const clear = useCompareStore((s) => s.clear);
  const { t } = useTranslation();

  const productIds = useMemo(() => {
    if (!idsParam) return [];
    return idsParam
      .split(",")
      .map(Number)
      .filter((n) => !Number.isNaN(n) && n > 0)
      .slice(0, 4);
  }, [idsParam]);

  const { data, isLoading, error, refetch } = useCompareProducts(productIds);
  const provenanceById = useProductProvenanceMap(
    data?.products.map((product) => product.product_id) ?? [],
  );
  const { track } = useAnalytics();

  const recommendationAllowed =
    data?.products.every((product) => {
      const provenance = provenanceById[product.product_id];
      return (
        !provenance?.isLoading && !provenance?.error && canRecommendFromProvenance(provenance?.data)
      );
    }) ?? false;
  const exportAllowed =
    data?.products.every((product) => {
      const provenance = provenanceById[product.product_id];
      return (
        !provenance?.isLoading &&
        !provenance?.error &&
        provenance?.data !== undefined &&
        hasConfirmedExportEvidence(product, provenance.data)
      );
    }) ?? false;
  const productProvenance = Object.fromEntries(
    data?.products.map((product) => [
      product.product_id,
      provenanceById[product.product_id]?.data,
    ]) ?? [],
  );

  const exportableProducts: ExportableProduct[] = useMemo(() => {
    if (!data?.products) return [];
    return data.products.map((p) => ({
      product_name: p.product_name,
      brand: p.brand,
      ean: p.ean ?? undefined,
      category: p.category,
      unhealthiness_score: p.unhealthiness_score,
      nutri_score_label: p.nutri_score ?? "–",
      nova_group: p.nova_group ?? "–",
      calories_kcal: p.calories ?? undefined,
      total_fat_g: p.total_fat_g ?? undefined,
      saturated_fat_g: p.saturated_fat_g ?? undefined,
      sugars_g: p.sugars_g ?? undefined,
      salt_g: p.salt_g ?? undefined,
      protein_g: p.protein_g ?? undefined,
      fiber_g: p.fibre_g ?? undefined,
      allergen_tags: p.allergen_tags ? p.allergen_tags.split(",").map((s) => s.trim()) : undefined,
      confidence_band: p.confidence,
    }));
  }, [data?.products]);

  useEffect(() => {
    if (productIds.length >= 2) {
      track("compare_opened", {
        product_ids: productIds,
        count: productIds.length,
      });
      void eventBus.emit({
        type: "product.compared",
        payload: { productIds },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIds.length]);

  // Empty state — no IDs provided
  if (productIds.length < 2) {
    return (
      <AppPage className={styles.page}>
        <AppPageHeader
          eyebrow={t("nav.compare")}
          title={t("compare.title")}
          description={t("compare.useCheckbox")}
        />
        <EmptyStateIllustration
          type="no-comparisons"
          titleKey="compare.selectPrompt"
          descriptionKey="compare.useCheckbox"
          action={{ labelKey: "compare.searchProducts", href: "/app/search" }}
          secondaryAction={{
            labelKey: "compare.savedComparisons",
            href: "/app/compare/saved",
          }}
        />
      </AppPage>
    );
  }

  return (
    <AppPage className={`compare-print-container ${styles.page}`}>
      <Breadcrumbs items={[{ labelKey: "nav.home", href: "/app" }, { labelKey: "nav.compare" }]} />
      <AppPageHeader
        eyebrow={t("nav.compare")}
        title={t("compare.title")}
        description={t("compare.comparing", { count: productIds.length })}
        actions={
          <div className={`no-print ${styles.actions}`}>
            <Link href="/app/compare/saved" className={styles.textAction}>
              <FolderOpen size={16} className="inline-block" aria-hidden="true" />{" "}
              {t("compare.savedComparisons")}
            </Link>
            <button type="button" onClick={clear} className={styles.textAction}>
              {t("compare.clearSelection")}
            </button>
            <PrintButton />
          </div>
        }
      />

      {/* Loading */}
      {isLoading ? <ComparisonGridSkeleton /> : null}

      {/* Error */}
      {error ? (
        <EmptyState
          variant="error"
          titleKey="compare.loadFailed"
          action={{ labelKey: "common.retry", onClick: () => void refetch() }}
        />
      ) : null}

      {/* Comparison grid */}
      {data && data.products.length >= 2 ? (
        <>
          {/* Share / Save toolbar */}
          <div className={`no-print ${styles.toolbar}`}>
            <div className={styles.toolbarActions}>
              {exportAllowed ? (
                <>
                  <ExportButton products={exportableProducts} filename="comparison" comparison />
                  <ShareComparison productIds={productIds} />
                </>
              ) : (
                <span
                  className="text-xs text-warning-text"
                  role="status"
                  data-testid="comparison-export-withheld"
                >
                  {t("compare.exportAndSharingWithheld")}
                </span>
              )}
            </div>
          </div>

          <div className={styles.evidenceGrid}>
            {data.products.map((product) => {
              const provenance = provenanceById[product.product_id];
              return (
                <ProductEvidencePanel
                  key={product.product_id}
                  provenance={provenance?.data}
                  isLoading={provenance?.isLoading ?? true}
                  error={provenance?.error ?? null}
                  onRetry={() => {
                    void provenance?.refetch();
                  }}
                  compact
                />
              );
            })}
          </div>

          <ErrorBoundary level="section" context={{ section: "comparison-grid" }}>
            <ComparisonGrid
              products={data.products}
              showAvoidBadge
              recommendationAllowed={recommendationAllowed}
              provenanceByProductId={productProvenance}
            />
          </ErrorBoundary>
        </>
      ) : null}

      {/* Partial results — some products not found */}
      {data && data.products.length < productIds.length ? (
        <div className={styles.partial}>
          <p>
            <AlertTriangle size={16} aria-hidden="true" />{" "}
            {t("compare.productsNotFound", {
              count: productIds.length - data.products.length,
            })}{" "}
            {t("compare.onlyShowingAvailable")}
          </p>
        </div>
      ) : null}
    </AppPage>
  );
}
