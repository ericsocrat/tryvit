import type { Metadata } from "next";
import { fetchPublicSharedComparison } from "@/lib/public-shares";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const comparison = await fetchPublicSharedComparison(token);

  const productNames: string[] = (comparison?.products ?? []).map(
    (p: { product_name: string }) => p.product_name,
  );
  const title =
    productNames.length >= 2
      ? `Compare: ${productNames.slice(0, 3).join(" vs ")}`
      : "Product Comparison — TryVit";
  const description =
    productNames.length >= 2
      ? `See how ${productNames[0]} compares to ${productNames[1]} on TryVit`
      : "Compare food products with multi-axis health scoring on TryVit";

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "TryVit",
    },
  };
}

export default function SharedComparisonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
