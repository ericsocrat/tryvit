import type { Metadata } from "next";

import { getServerLocale } from "@/lib/server-locale";

import { buildLandingMetadata } from "./_landing-v2/copy";
import { HomePageContent } from "./HomePageContent";

export async function generateMetadata(): Promise<Metadata> {
  return buildLandingMetadata(await getServerLocale());
}

export default async function HomePage() {
  const language = await getServerLocale();
  return <HomePageContent language={language} />;
}
