import { LivePublicAuthProvider } from "@/components/layout/LivePublicAuthActions";
import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import { buildWebSiteStructuredData } from "@/lib/site-metadata";
import type { SupportedLanguage } from "@/stores/language-store";

import { getLandingCopy, getLandingMetadataCopy } from "./_landing-v2/copy";
import { LandingPublicShell } from "./_landing-v2/LandingPublicShell";
import { LandingSections } from "./LandingSections";

export function HomePageContent({ language }: Readonly<{ language: SupportedLanguage }>) {
  const readiness = getDeploymentReadiness();
  const dataAvailable = readiness.dataBackend === "available";
  const copy = getLandingCopy(language);
  const metadataCopy = getLandingMetadataCopy(language, readiness);
  const jsonLd = {
    ...buildWebSiteStructuredData(readiness),
    description: metadataCopy.description,
    inLanguage: language,
  };

  const content = (
    <LandingPublicShell copy={copy} dataAvailable={dataAvailable}>
      <LandingSections dataAvailable={dataAvailable} language={language} />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
    </LandingPublicShell>
  );

  return dataAvailable ? <LivePublicAuthProvider>{content}</LivePublicAuthProvider> : content;
}
