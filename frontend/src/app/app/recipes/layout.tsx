import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recipes",
  description:
    "Browse recipe instructions and ingredients. Filter by category and difficulty.",
};

export default function RecipesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
