import type { Metadata } from "next";
import { publicShareMetadata } from "@/app/_public-share/share-metadata";
import { getServerLocale } from "@/lib/server-locale";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function generateMetadata(): Promise<Metadata> {
  return publicShareMetadata("comparison", await getServerLocale());
}
export default function SharedLayout({ children }: { children: React.ReactNode }) { return children; }
