import { LivePublicAuthProvider } from "@/components/layout/LivePublicAuthState";
import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import { buildWebSiteStructuredData } from "@/lib/site-metadata";
import type { SupportedLanguage } from "@/stores/language-store";

import { getLandingCopy } from "./_landing-v2/copy";
import { LandingPublicShell } from "./_landing-v2/LandingPublicShell";
import { LandingSections } from "./LandingSections";

export function HomePageContent({ language }: Readonly<{ language: SupportedLanguage }>) {
  const readiness = getDeploymentReadiness();
  const dataAvailable = readiness.dataBackend === "available";
  const copy = getLandingCopy(language);
  const jsonLd = {
    ...buildWebSiteStructuredData(readiness),
    description: dataAvailable ? copy.metadata.description : copy.demoIntro,
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
