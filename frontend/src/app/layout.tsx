import { Providers } from "@/components/Providers";
import { ThemeScript } from "@/components/ThemeScript";
import { SkipLinkControl } from "@/design-system/accessibility/SkipLinkControl.client";
import { IS_QA_MODE } from "@/lib/qa-mode";
import { getInitialClientMessages } from "@/lib/i18n-server";
import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import { translate } from "@/lib/i18n-core";
import {
  LANDING_PROVIDER_BOUNDARY,
  PROVIDER_BOUNDARY_REQUEST_HEADER,
} from "@/lib/request-provider-boundary";
import { getServerLocale } from "@/lib/server-locale";
import {
  buildRootMetadata,
  buildRootWebApplicationStructuredData,
} from "@/lib/site-metadata";
import { THEME_CHROME_COLORS } from "@/design-system/accessibility/theme-contract";
import "@/styles/globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_CHROME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_CHROME_COLORS.dark },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export function generateMetadata(): Metadata {
  return buildRootMetadata(getDeploymentReadiness());
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [language, requestHeaders] = await Promise.all([getServerLocale(), headers()]);
  const usesLandingProviderBoundary =
    requestHeaders.get(PROVIDER_BOUNDARY_REQUEST_HEADER) === LANDING_PROVIDER_BOUNDARY;
  const jsonLd = buildRootWebApplicationStructuredData(getDeploymentReadiness());

  return (
    <html
      lang={language}
      data-design-system="v1"
      suppressHydrationWarning
      {...(IS_QA_MODE ? { "data-qa-mode": "true" } : {})}
    >
      <head>
        <ThemeScript />
        {IS_QA_MODE && (
          <style
            dangerouslySetInnerHTML={{
              __html:
                "*, *::before, *::after { transition: none !important; animation: none !important; }",
            }}
          />
        )}
        {jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
      </head>
      <body data-provider-boundary={usesLandingProviderBoundary ? "landing" : "application"}>
        {usesLandingProviderBoundary ? (
          <>
            <SkipLinkControl label={translate(language, "a11y.skipToContent")} />
            {children}
          </>
        ) : (
          <Providers
            initialLanguage={language}
            initialMessages={getInitialClientMessages(language)}
          >
            {children}
          </Providers>
        )}
        {!IS_QA_MODE && <SpeedInsights />}
      </body>
    </html>
  );
}
