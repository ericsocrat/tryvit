import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import type { SupportedLanguage } from "@/stores/language-store";

import { getLandingCopy } from "./_landing-v2/copy";
import { LandingPublicShell } from "./_landing-v2/LandingPublicShell";
import { LandingSections } from "./LandingSections";

export function HomePageContent({ language }: Readonly<{ language: SupportedLanguage }>) {
  const readiness = getDeploymentReadiness();
  const dataAvailable = readiness.dataBackend === "available";
  const copy = getLandingCopy(language);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TryVit",
    url: "https://tryvit.vercel.app",
    description: copy.metadata.description,
    inLanguage: language,
    ...(dataAvailable
      ? {
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: "https://tryvit.vercel.app/app/search?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
        }
      : {}),
  };

  return (
    <LandingPublicShell copy={copy} dataAvailable={dataAvailable}>
      <LandingSections dataAvailable={dataAvailable} language={language} />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
    </LandingPublicShell>
  );
}
