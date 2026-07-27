// ─── Public home / landing page (server component) ───────────────────────
// SEO metadata + JSON-LD structured data.
// Interactive sections live in LandingSections.tsx (client component).
// Issue #698 — convert to server component with full SEO metadata

import type { Metadata } from "next";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getDeploymentReadiness } from "@/lib/deployment-readiness";

import { LandingSections } from "./LandingSections";

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
    description:
      "Compare food products, understand nutrition scores, and make healthier choices.",
    images: ["/opengraph-image"],
  },
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function HomePage() {
  const readiness = getDeploymentReadiness();
  const dataAvailable = readiness.dataBackend === "available";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TryVit",
    url: "https://tryvit.vercel.app",
    description:
      "Compare food products, understand nutrition scores, and make healthier choices.",
    ...(dataAvailable
      ? {
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate:
                "https://tryvit.vercel.app/app/search?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
        }
      : {}),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header dataAvailable={dataAvailable} />

      <main id="main-content" className="flex-1">
        <LandingSections dataAvailable={dataAvailable} />
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
