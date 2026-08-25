import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { LivePublicAuthProvider } from "@/components/layout/LivePublicAuthActions";
import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import { translate } from "@/lib/i18n-core";
import { buildWebSiteStructuredData } from "@/lib/site-metadata";
import type { SupportedLanguage } from "@/stores/language-store";
import { LandingSections } from "./LandingSections";

export function HomePageContent({ language }: { language: SupportedLanguage }) {
  const readiness = getDeploymentReadiness();
  const dataAvailable = readiness.dataBackend === "available";
  const jsonLd = buildWebSiteStructuredData(readiness);

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

      <main id="main-content" data-route-id="public-landing" className="flex-1">
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
