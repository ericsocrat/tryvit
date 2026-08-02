import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { LivePublicAuthProvider } from "@/components/layout/LivePublicAuthActions";
import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import { translate } from "@/lib/i18n-core";
import type { SupportedLanguage } from "@/stores/language-store";
import { LandingSections } from "./LandingSections";

export function HomePageContent({ language }: { language: SupportedLanguage }) {
  const readiness = getDeploymentReadiness();
  const dataAvailable = readiness.dataBackend === "available";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TryVit",
    url: "https://tryvit.vercel.app",
    description: "Compare food products, understand nutrition scores, and make healthier choices.",
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

  const content = (
    <div className="flex min-h-screen flex-col">
      <PublicHeader
        dataAvailable={dataAvailable}
        contactLabel={translate(language, "layout.contact")}
        signInLabel={translate(language, "auth.signIn")}
        dashboardLabel={translate(language, "auth.dashboard")}
        demoLabel={translate(language, "landing.demoMode")}
        themeLabel={translate(language, "theme.label")}
        lightThemeLabel={translate(language, "theme.light")}
        darkThemeLabel={translate(language, "theme.dark")}
      />

      <main id="main-content" className="flex-1">
        <LandingSections dataAvailable={dataAvailable} language={language} />
      </main>

      <PublicFooter
        learnLabel={translate(language, "learn.hubTitle")}
        privacyLabel={translate(language, "layout.privacy")}
        termsLabel={translate(language, "layout.terms")}
        contactLabel={translate(language, "layout.contact")}
        copyrightLabel={translate(language, "layout.copyright", {
          year: new Date().getFullYear(),
        })}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );

  return dataAvailable ? <LivePublicAuthProvider>{content}</LivePublicAuthProvider> : content;
}
