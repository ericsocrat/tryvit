import { Providers } from "@/components/Providers";
import { ThemeScript } from "@/components/ThemeScript";
import { IS_QA_MODE } from "@/lib/qa-mode";
import { getInitialClientMessages } from "@/lib/i18n-server";
import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import { getServerLocale } from "@/lib/server-locale";
import {
  buildRootMetadata,
  buildRootWebApplicationStructuredData,
} from "@/lib/site-metadata";
import { THEME_CHROME_COLORS } from "@/design-system/accessibility/theme-contract";
import "@/styles/globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";

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
  const language = await getServerLocale();
  const initialMessages = getInitialClientMessages(language);
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
      <body>
        <Providers initialLanguage={language} initialMessages={initialMessages}>
          {children}
        </Providers>
        {!IS_QA_MODE && <SpeedInsights />}
      </body>
    </html>
  );
}
