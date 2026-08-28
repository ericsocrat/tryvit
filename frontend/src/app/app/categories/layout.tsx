import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Categories",
  description:
    "Browse food categories and inspect the available product records and evidence context.",
};

export default function CategoriesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
