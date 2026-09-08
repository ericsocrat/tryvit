"use client";

import { Button } from "@/components/common/Button";
import { CompareCheckbox } from "@/components/compare/CompareCheckbox";
import { EvidenceLoading, EvidenceSummary, ProductClassifications, ProductIdentityImage, ProductIngredientsAndAllergens, ProductNutrition, ProductPositiveAllergenNotice, ProductSources } from "@/components/evidence/ProductEvidence";
import styles from "@/components/evidence/evidence.module.css";
import { AppPage } from "@/components/layout/AppPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AddToListMenu } from "@/components/product/AddToListMenu";
import { recordProductView } from "@/lib/api";
import { evidenceQueryKeys, getProductReadModels } from "@/lib/evidence/api";
import { useTranslation } from "@/lib/i18n";
import { IS_QA_MODE } from "@/lib/qa-mode";
import { createClient } from "@/lib/supabase/client";
import { useCompareStore } from "@/stores/compare-store";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function ProductDetailPage() {
  const params = useParams();
  const rawId = typeof params.id === "string" ? params.id : "";
  const productId = /^[1-9][0-9]*$/.test(rawId) ? Number(rawId) : Number.NaN;
  const validId = Number.isSafeInteger(productId) && productId > 0;
  const { t, language } = useTranslation();
  const recordedId = useRef<number | null>(null);
  const selectedIds = useCompareStore((state) => state.selectedIds);
  const query = useQuery({
    queryKey: evidenceQueryKeys.products(validId ? [productId] : [], language),
    queryFn: async () => {
      const result = await getProductReadModels(createClient(), [productId], language);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    enabled: validId,
    staleTime: 60_000,
  });
  const product = query.data?.products.find((item) => item.product_id === productId);

  useEffect(() => {
    if (!product || query.isError || IS_QA_MODE || recordedId.current === product.product_id) return;
    recordedId.current = product.product_id;
    // Viewing history is not a health achievement. Do not emit the legacy score event.
    void recordProductView(createClient(), product.product_id).catch(() => {
      // Optional history failure never masks the successfully loaded product.
    });
  }, [product, query.isError]);

  const navigation = <Breadcrumbs items={[{ labelKey: "nav.home", href: "/app" }, { labelKey: "nav.find", href: "/app/search" }, { labelKey: "evidenceUi.productTitle" }]} />;

  if (!validId) return <AppPage>{navigation}<ProductNotFound /></AppPage>;
  if (query.isPending) return <EvidenceLoading />;
  if (query.isError) return <AppPage>{navigation}<section className={styles.state} role="alert"><h1>{t("evidenceUi.productError")}</h1><p>{t("evidenceUi.retryExplanation")}</p><Button onClick={() => void query.refetch()} loading={query.isFetching}>{t("common.retry")}</Button></section></AppPage>;
  if (!product) return <AppPage>{navigation}<ProductNotFound /></AppPage>;

  return (
    <AppPage>
      {navigation}
      <header className={styles.productHeader}>
        <ProductIdentityImage product={product} />
        <div className={styles.productIdentity}>
          <p className={styles.kicker}>{product.category} · {product.country}</p>
          <h1>{product.product_name}</h1>
          {product.brand ? <p className={styles.brand}>{product.brand}</p> : null}
          {product.product_name_original !== product.product_name ? <p className={styles.metadata}>{t("evidenceUi.originalName", { name: product.product_name_original })}</p> : null}
          {product.ean ? <p className={styles.metadata}>{t("evidenceUi.barcode", { barcode: product.ean })}</p> : null}
          {product.is_deprecated ? <p className={styles.caution}>{t("evidenceUi.catalogArchived")}</p> : null}
        </div>
        <div className={styles.actions} data-no-print>
            <AddToListMenu productId={product.product_id} showLabel />
            <CompareCheckbox productId={product.product_id} productName={product.product_name} showLabel />
            {selectedIds.size >= 2 ? <Link href={`/app/compare?ids=${[...selectedIds].join(",")}`} className={styles.textLink}>{t("evidenceUi.openComparison")}</Link> : null}
        </div>
        <ProductPositiveAllergenNotice product={product} />
        <EvidenceSummary product={product} />
      </header>
      <div className={styles.detailColumns}>
        <ProductNutrition product={product} />
        <div className={styles.detailStack}><ProductIngredientsAndAllergens product={product} /><ProductClassifications product={product} /></div>
      </div>
      <ProductSources product={product} />
    </AppPage>
  );
}

function ProductNotFound() {
  const { t } = useTranslation();
  return <section className={styles.state}><h1>{t("evidenceUi.productNotFound")}</h1><p>{t("evidenceUi.productNotFoundDescription")}</p><Link href="/app/search" className={styles.textLink}>{t("nav.find")}</Link></section>;
}
