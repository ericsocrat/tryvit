// ─── Public home / landing page (server component) ───────────────────────
// SEO metadata + JSON-LD structured data.
// Narrative sections render on the server; only the theme toggle is a client island.
// Issue #698 — convert to server component with full SEO metadata

import type { Metadata } from "next";

import { getServerLocale } from "@/lib/server-locale";
import { HomePageContent } from "./HomePageContent";

// ─── SEO metadata (merged with root layout defaults) ────────────────────────

export const metadata: Metadata = {
  title: "TryVit — Know What You Eat",
  description:
    "Explore TryVit food scoring, ingredient transparency, and healthier-choice tools. Live data features depend on current service availability.",
  openGraph: {
    title: "TryVit — Know What You Eat",
    description:
      "Explore TryVit food scoring, ingredient transparency, and healthier-choice tools. Live data features depend on current service availability.",
    images: ["/opengraph-image"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TryVit — Know What You Eat",
    description: "Compare food products, understand nutrition scores, and make healthier choices.",
    images: ["/opengraph-image"],
  },
};

export default async function HomePage() {
  const language = await getServerLocale();
  return <HomePageContent language={language} />;
}
