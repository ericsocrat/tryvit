import type { Metadata } from "next";
import { translate } from "@/lib/i18n-core";
import type { SupportedLanguage } from "@/stores/language-store";

/** Third-party crawlers must never cache token-gated collection contents. */
export function publicShareMetadata(kind: "list" | "comparison", language: SupportedLanguage): Metadata {
  const title = translate(language, kind === "list" ? "publicEvidenceShare.metadataList" : "publicEvidenceShare.metadataComparison");
  const description = translate(language, "publicEvidenceShare.metadataDescription");
  return { title, description, referrer: "no-referrer",
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    openGraph: { title, description, type: "website", siteName: "TryVit" },
  };
}
