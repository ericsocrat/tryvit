"use client";

import { Button } from "@/components/common/Button";
import { EvidenceLoading, EvidenceSummary, NutrientValue, ProductAllergenSummary, ProductSources } from "@/components/evidence/ProductEvidence";
import styles from "@/components/evidence/evidence.module.css";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import { useSaveComparison } from "@/hooks/use-compare";
import { evidenceQueryKeys, getProductReadModels } from "@/lib/evidence/api";
import { parseComparisonIds } from "@/lib/evidence/comparison-selection";
import { compareProductNutrient, NUTRIENT_KEYS, type NutrientKey, type ProductReadModel } from "@/lib/evidence/product-read-model";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useCompareStore } from "@/stores/compare-store";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";

export default function ComparePage() {
  return <Suspense fallback={<EvidenceLoading comparison />}><ComparisonRoute /></Suspense>;
}

function ComparisonRoute() {
  const searchParams = useSearchParams();
  const parameter = searchParams.get("ids") ?? "";
  // Mutation feedback belongs to one URL selection, never a later comparison.
  return <ComparisonWorkspace key={parameter} parameter={parameter} />;
}

function ComparisonWorkspace({ parameter }: Readonly<{ parameter: string }>) {
  const router = useRouter();
  const { ids, invalid } = useMemo(() => parseComparisonIds(parameter), [parameter]);
  const { t, language } = useTranslation();
  const clear = useCompareStore((state) => state.clear);
  const add = useCompareStore((state) => state.add);
  const selectedIds = useCompareStore((state) => state.selectedIds);
  const save = useSaveComparison();
  const enabled = !invalid && ids.length >= 2;
  const query = useQuery({
    queryKey: evidenceQueryKeys.products(ids, language),
    queryFn: async () => {
      const result = await getProductReadModels(createClient(), ids, language);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    enabled,
    staleTime: 60_000,
  });
  const products = ids.flatMap((id) => query.data?.products.find((product) => product.product_id === id) ?? []);
  const missingCount = query.data ? ids.length - products.length : 0;
  const identityKey = products.map((product) => `${product.product_id}:${product.product_name}`).join("|");

  useEffect(() => {
    if (!enabled || !query.data || query.isError) return;
    // URL is authoritative, including browser back/forward and shared links.
    clear();
    for (const id of ids) {
      const product = query.data.products.find((item) => item.product_id === id);
      if (product) add(product.product_id, product.product_name);
    }
  }, [add, clear, enabled, ids, identityKey, query.data, query.isError]);

  function clearComparison() {
    clear();
    router.push("/app/compare");
  }

  return (
    <AppPage className="compare-print-container">
      <AppPageHeader eyebrow={t("nav.compare")} title={t("evidenceUi.compareTitle")} description={t("evidenceUi.compareIntro")} compactOnMobile />
      {invalid ? <section className={styles.state} role="alert"><h2>{t("evidenceUi.invalidComparison")}</h2><p>{t("evidenceUi.selectTwoToFour")}</p><Link href="/app/search" className={styles.textLink}>{t("nav.find")}</Link></section> : null}
      {!invalid && !enabled ? <section className={styles.state}>
        <h2>{t("evidenceUi.selectTwoToFour")}</h2>
        <p>{t("evidenceUi.selectHint")}</p>
        <div className={styles.actions}><Link href="/app/search" className={styles.textLink}>{t("nav.find")}</Link><Link href="/app/compare/saved" className={styles.textLink}>{t("compare.savedComparisons")}</Link>{selectedIds.size >= 2 ? <Link href={`/app/compare?ids=${[...selectedIds].join(",")}`} className={styles.textLink}>{t("evidenceUi.compareSelected")}</Link> : null}</div>
      </section> : null}
      {enabled && query.isPending ? <EvidenceLoading comparison /> : null}
      {enabled && query.isError ? <section className={styles.state} role="alert"><h2>{t("evidenceUi.comparisonError")}</h2><p>{t("evidenceUi.retryExplanation")}</p><Button loading={query.isFetching} onClick={() => void query.refetch()}>{t("common.retry")}</Button></section> : null}
      {enabled && query.data && !query.isError ? <>
        {missingCount > 0 ? <p className={styles.caution} role="status">{t("evidenceUi.comparisonMissing", { count: missingCount })}</p> : null}
        {products.length < 2 ? <section className={styles.state}><h2>{t("evidenceUi.comparisonInsufficient")}</h2><Link href="/app/search" className={styles.textLink}>{t("nav.find")}</Link></section> : <>
          <p className={styles.reference}>{t("evidenceUi.referenceProduct", { name: products[0].product_name })}</p>
          <PrimaryComparison products={products} />
          <p className={styles.interpretation}>{t("evidenceUi.compareIntro")}</p>
          <div className={`${styles.actions} ${styles.secondaryActions}`} data-no-print>
            <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate({ productIds: products.map((product) => product.product_id) })}>{t("compare.saveComparison")}</Button>
            <Button variant="ghost" onClick={clearComparison}>{t("compare.clearSelection")}</Button>
            <Link href="/app/compare/saved" className={styles.textLink}>{t("compare.savedComparisons")}</Link>
            {save.isSuccess ? <span role="status">{t("evidenceUi.comparisonSaved")}</span> : null}
            {save.isError ? <span role="alert">{t("evidenceUi.comparisonSaveFailed")}</span> : null}
          </div>
          <div className={styles.comparisonEvidence}>{products.map((product) => <section key={product.product_id} className={styles.panel} aria-label={product.product_name}><h2><Link href={`/app/product/${product.product_id}`}>{product.product_name}</Link></h2><EvidenceSummary product={product} /><h3>{t("evidenceUi.allergensTitle")}</h3><ProductAllergenSummary product={product} /><ProductSources product={product} /></section>)}</div>
        </>}
      </> : null}
    </AppPage>
  );
}

function PrimaryComparison({ products }: Readonly<{ products: ProductReadModel[] }>) {
  const { t } = useTranslation();
  const pairwise = products.length === 2;
  return <div className={styles.primaryComparison} data-testid="primary-comparison">
    {pairwise ? <section className={styles.mobilePairwise} aria-label={t("evidenceUi.compareTable")}>
      <div className={styles.pairwiseProducts}>{products.map((product, index) => <div key={product.product_id}>
        <span className={styles.pairwiseMarker} aria-hidden="true">{index === 0 ? "A" : "B"}</span>
        <Link href={`/app/product/${product.product_id}`}>{product.product_name}</Link>
        <span>{product.brand}</span>
      </div>)}</div>
      <div className={styles.pairwiseFacts} data-testid="first-comparison-facts">{NUTRIENT_KEYS.map((key) => {
        const titleId = `pairwise-${key}`;
        return <section key={key} className={styles.pairwiseFact} aria-labelledby={titleId}>
          <h2 id={titleId}>{t(`evidenceUi.nutrient.${key}`)}</h2>
          <div className={styles.pairwiseValues}>{products.map((product, index) => <div key={product.product_id} aria-label={`${t(`evidenceUi.nutrient.${key}`)} — ${product.product_name}`}>
            <span className="sr-only">{product.product_name}</span>
            <NutrientValue observation={product.nutrition[key]} />
            {index > 0 ? <ComparisonRelation product={product} reference={products[0]} nutrient={key} /> : null}
          </div>)}</div>
        </section>;
      })}</div>
    </section> : null}
    {!pairwise ? <p id="comparison-scroll-hint" className={styles.comparisonHint}>{t("evidenceUi.comparisonScrollHint")}</p> : null}
    <div className={`${styles.comparisonScroll} ${pairwise ? styles.twoProductTable : ""}`} data-testid={!pairwise ? "first-comparison-facts" : undefined} role="region" aria-label={t("evidenceUi.compareTable")} aria-describedby={!pairwise ? "comparison-scroll-hint" : undefined} tabIndex={pairwise ? undefined : 0}>
      <table className={styles.comparisonTable}>
        <caption className="sr-only">{t("evidenceUi.compareTable")}</caption>
        <thead><tr><th scope="col">{t("evidenceUi.nutritionTitle")}</th>{products.map((product) => <th scope="col" key={product.product_id}><Link href={`/app/product/${product.product_id}`}>{product.product_name}</Link><span>{product.brand}</span></th>)}</tr></thead>
        <tbody>{NUTRIENT_KEYS.map((key) => <tr key={key}><th scope="row">{t(`evidenceUi.nutrient.${key}`)}</th>{products.map((product, index) => <td key={product.product_id}><NutrientValue observation={product.nutrition[key]} />{index > 0 ? <ComparisonRelation product={product} reference={products[0]} nutrient={key} /> : null}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </div>;
}

function ComparisonRelation({ product, reference, nutrient }: Readonly<{ product: ProductReadModel; reference: ProductReadModel; nutrient: NutrientKey }>) {
  const { t } = useTranslation();
  const relation = compareProductNutrient(product, reference, nutrient);
  return <p className={styles.relation}>{t(relation.comparable ? `evidenceUi.relation.${relation.relation}` : `evidenceUi.notComparable.${relation.reason}`)}</p>;
}
