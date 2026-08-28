import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search Products",
  description:
    "Search and filter food products by name, brand, category, or barcode, then inspect the available evidence.",
};

export default function SearchLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
