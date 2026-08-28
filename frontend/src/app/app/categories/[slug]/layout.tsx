import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    title: name,
    description: `Browse ${name.toLowerCase()} products and inspect their available nutrition and evidence context.`,
  };
}

export default function CategoryDetailLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
