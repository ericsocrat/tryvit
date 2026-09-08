import type { Metadata } from "next";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { evidenceQueryKeys } from "@/lib/evidence/api";
import type { ProductReadModel } from "@/lib/evidence/product-read-model";
import { translate } from "@/lib/i18n-core";
import { getServerLocale } from "@/lib/server-locale";
import { publicBaseUrl } from "@/lib/site-metadata";
import { isValidEanChecksum } from "@/lib/validation";
import { fetchProductEvidence } from "./product-read.server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, language] = await Promise.all([params, getServerLocale()]);
  const envelope = await fetchProductEvidence(id, language);
  const product = envelope?.products.find((item) => String(item.product_id) === String(Number(id)));
  if (!product) return { title: translate(language, "evidenceUi.productTitle") };

  const description = product.brand
    ? translate(language, "product.metadataDescriptionWithBrand", { name: product.product_name, brand: product.brand })
    : translate(language, "product.metadataDescription", { name: product.product_name });
  return {
    title: product.product_name,
    description,
    openGraph: { title: product.product_name, description, type: "article" },
    twitter: { card: "summary_large_image", title: product.product_name, description },
  };
}

function productJsonLd(product: ProductReadModel): Record<string, unknown> {
  const ean = product.ean;
  const gtin = ean && isValidEanChecksum(ean) && [8, 12, 13].includes(ean.length) ? { [`gtin${ean.length}`]: ean } : {};
  return {
    "@context": "https://schema.org", "@type": "Product",
    name: product.product_name,
    url: `${publicBaseUrl()}/app/product/${product.product_id}`,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.image ? { image: product.image.url } : {}),
    ...gtin,
  };
}

export default async function ProductLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ id: string }> }>) {
  const [{ id }, language] = await Promise.all([params, getServerLocale()]);
  const envelope = await fetchProductEvidence(id, language);
  const product = envelope?.products.find((item) => item.product_id === Number(id));
  const client = new QueryClient();
  // Client and server use the identical v2 envelope/key. Never hydrate the retired profile.
  if (envelope) client.setQueryData(evidenceQueryKeys.products([Number(id)], language), envelope);
  return <>
    {product ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product)).replace(/</g, "\\u003c") }} /> : null}
    <HydrationBoundary state={dehydrate(client)}>{children}</HydrationBoundary>
  </>;
}
