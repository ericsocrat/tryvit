import { Providers } from "@/components/Providers";
import { ThemeScript } from "@/components/ThemeScript";
import { IS_QA_MODE } from "@/lib/qa-mode";
import "@/styles/globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1DB954" },
    { media: "(prefers-color-scheme: dark)", color: "#0A2E1A" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "TryVit — Food Health Scanner",
    template: "%s | TryVit",
  },
  description:
    "Scan barcodes and instantly see a science-driven health score for food products sold in Poland.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TryVit",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "TryVit",
    locale: "en_US",
    title: "TryVit — Food Health Scanner",
    description:
      "Scan barcodes and see a health score for food products sold in Poland.",
    url: "https://tryvit.vercel.app",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "TryVit — Scan. Score. Choose better.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TryVit",
    description:
      "Scan barcodes and see a health score for food products sold in Poland.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    "msapplication-TileColor": "#1DB954",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://tryvit.vercel.app",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "TryVit",
    url: "https://tryvit.vercel.app",
    description:
      "Scan barcodes and instantly see a science-driven health score for food products sold in Poland.",
    applicationCategory: "HealthApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires a modern web browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "PLN",
    },
  };

  return (
    <html
      lang="en"
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        {!IS_QA_MODE && <SpeedInsights />}
      </body>
    </html>
  );
}
