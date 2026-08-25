// ─── Public home / landing page (server component) ───────────────────────
// SEO metadata + JSON-LD structured data.
// Narrative sections render on the server; only the theme toggle is a client island.
// Issue #698 — convert to server component with full SEO metadata

import type { Metadata } from "next";

import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import { getServerLocale } from "@/lib/server-locale";
import { buildLandingMetadata } from "@/lib/site-metadata";
import { HomePageContent } from "./HomePageContent";

// ─── SEO metadata (merged with root layout defaults) ────────────────────────

export function generateMetadata(): Metadata {
  return buildLandingMetadata(getDeploymentReadiness());
}

export default async function HomePage() {
  const language = await getServerLocale();
  return <HomePageContent language={language} />;
}
