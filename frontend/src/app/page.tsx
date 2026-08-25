import type { Metadata } from "next";

import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import { getServerLocale } from "@/lib/server-locale";

import { buildLandingMetadata } from "./_landing-v2/copy";
import { HomePageContent } from "./HomePageContent";

export async function generateMetadata(): Promise<Metadata> {
  return buildLandingMetadata(await getServerLocale(), getDeploymentReadiness());
}

export default async function HomePage() {
  const language = await getServerLocale();
  return <HomePageContent language={language} />;
}
