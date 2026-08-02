import type { Metadata } from "next";
import { fetchPublicSharedList } from "@/lib/public-shares";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const listData = await fetchPublicSharedList(token);

  const listName: string = listData?.list_name ?? "Product List";
  const totalCount: number = listData?.total_count ?? 0;

  const title = `${listName} — TryVit List`;
  const description =
    totalCount > 0
      ? `A curated list of ${totalCount} food products on TryVit`
      : "A curated product list on TryVit";

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

export default function SharedListLayout({ children }: { children: React.ReactNode }) {
  return children;
}
