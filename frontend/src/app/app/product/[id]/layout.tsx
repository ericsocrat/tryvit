// ─── Product [id] layout — dynamic metadata + Schema.org JSON-LD ──────────
// Provides og:title, og:description, twitter:card.  The opengraph-image.tsx
// file in this directory automatically sets og:image.
// Also injects a conservative Schema.org Product identity record.
// Pre-fetches the product profile and dehydrates the TanStack Query cache
// so the client component renders instantly without a second round-trip.

import type { Metadata } from "next";
import { cache } from "react";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { translate } from "@/lib/i18n-core";
import { queryKeys } from "@/lib/query-keys";
import { getServerLocale } from "@/lib/server-locale";
import { publicBaseUrl } from "@/lib/site-metadata";
import type { ProductProfile } from "@/lib/types";
import { isValidEanChecksum } from "@/lib/validation";
import type { SupportedLanguage } from "@/stores/language-store";

/* ---------- helpers ---------- */

/**
 * Fetch the product profile via server-side Supabase client.
 * Wrapped in React.cache() so generateMetadata + layout share one RPC call
 * per request instead of two.
 */
const fetchProfile = cache(
  async (
    productId: number,
    language: SupportedLanguage,
  ): Promise<ProductProfile | null> => {
    try {
      const supabase = await createServerSupabaseClient();
      const { data } = await supabase.rpc("api_get_product_profile", {
        p_product_id: productId,
        p_language: language,
      });
      return (data as ProductProfile) ?? null;
    } catch {
      return null;
    }
  },
);

/* ---------- metadata ---------- */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const [{ id }, language] = await Promise.all([params, getServerLocale()]);
  const profile = await fetchProfile(Number.parseInt(id, 10), language);

  if (!profile) {
    return { title: "Product" };
  }

  const name =
    (profile.product?.product_name_display as string) ??
    (profile.product?.product_name as string) ??
    "Product";
  const brand = (profile.product?.brand as string) ?? "";
  const description = brand
    ? translate(language, "product.metadataDescriptionWithBrand", {
        name,
        brand,
      })
    : translate(language, "product.metadataDescription", { name });

  return {
    title: name,
    description,
    openGraph: {
      title: name,
      description,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
    },
  };
}

/* ---------- JSON-LD builder ---------- */

function buildGtinProperty(ean: string | undefined): Record<string, string> {
  if (!ean || !isValidEanChecksum(ean)) return {};
  if (ean.length === 8) return { gtin8: ean };
  if (ean.length === 12) return { gtin12: ean };
  if (ean.length === 13) return { gtin13: ean };
  return {};
}

function buildProductJsonLd(
  profile: ProductProfile,
  productId: number,
): Record<string, unknown> {
  const name =
    (profile.product?.product_name_display as string) ??
    (profile.product?.product_name as string) ??
    "Product";
  const brand = (profile.product?.brand as string) ?? undefined;
  const ean = (profile.product?.ean as string) ?? undefined;
  const imageUrl = profile.images?.primary?.url ?? undefined;
  const gtin = buildGtinProperty(ean);

  const baseUrl = publicBaseUrl();

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    url: `${baseUrl}/app/product/${productId}`,
    ...(brand && { brand: { "@type": "Brand", name: brand } }),
    ...gtin,
    ...(imageUrl && { image: imageUrl }),
  };

  return jsonLd;
}

/* ---------- layout component ---------- */

export default async function ProductLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const [{ id }, language] = await Promise.all([params, getServerLocale()]);
  const productId = Number.parseInt(id, 10);

  // Single server-side fetch — reused for metadata (above) AND client cache.
  // The prefetchQuery populates the QueryClient; dehydrate() serializes it
  // into the HTML so the client's useQuery() resolves instantly.
  const profile = await fetchProfile(productId, language);

  const queryClient = new QueryClient();
  if (profile) {
    queryClient.setQueryData(queryKeys.productProfile(productId), profile);
  }

  return (
    <>
      {profile && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildProductJsonLd(profile, productId)),
          }}
        />
      )}
      <HydrationBoundary state={dehydrate(queryClient)}>
        {children}
      </HydrationBoundary>
    </>
  );
}
