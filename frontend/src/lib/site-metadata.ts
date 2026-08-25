import type { Metadata } from "next";

import type { SupportedLanguage } from "@/stores/language-store";

import type { DeploymentReadiness } from "./deployment-readiness";

const DEFAULT_PUBLIC_APP_URL = "https://tryvit.vercel.app";
const ROOT_TITLE = "TryVit — Food Intelligence";

const WEB_APPLICATION_COPY: Readonly<
  Record<
    SupportedLanguage,
    { readonly description: string; readonly featureList: readonly string[] }
  >
> = Object.freeze({
  en: {
    description:
      "Search food products, scan barcodes, and inspect TryVit scoring evidence for foods sold in Poland.",
    featureList: ["Food product search", "Barcode scanning", "Product scoring evidence"],
  },
  pl: {
    description:
      "Wyszukuj produkty spożywcze, skanuj kody kreskowe i sprawdzaj dane stojące za ocenami TryVit dla żywności sprzedawanej w Polsce.",
    featureList: ["Wyszukiwanie produktów", "Skanowanie kodów kreskowych", "Dane stojące za oceną produktu"],
  },
  de: {
    description:
      "Lebensmittel suchen, Barcodes scannen und die Evidenz hinter TryVit-Bewertungen für in Polen verkaufte Lebensmittel prüfen.",
    featureList: ["Lebensmittelsuche", "Barcode-Scan", "Evidenz zur Produktbewertung"],
  },
});

const descriptionFor = (readiness: DeploymentReadiness): string =>
  readiness.dataBackend === "available"
    ? "Search food products, scan barcodes, and inspect TryVit scoring evidence for foods sold in Poland."
    : "Explore TryVit food-scoring methodology and public information for foods sold in Poland. Live product data is currently unavailable.";

function publicBaseUrl(env: NodeJS.ProcessEnv): string {
  const configured = new URL(env.NEXT_PUBLIC_APP_URL ?? DEFAULT_PUBLIC_APP_URL);
  return new URL("/", configured).toString().replace(/\/$/u, "");
}

export function buildRootMetadata(
  readiness: DeploymentReadiness,
  env: NodeJS.ProcessEnv = process.env,
): Metadata {
  const description = descriptionFor(readiness);
  const baseUrl = publicBaseUrl(env);

  return {
    title: {
      default: ROOT_TITLE,
      template: "%s | TryVit",
    },
    description,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "TryVit",
      startupImage: [
        {
          url: "/splash/apple-splash-2796-1290.png",
          media:
            "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        {
          url: "/splash/apple-splash-2532-1170.png",
          media:
            "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        {
          url: "/splash/apple-splash-2436-1125.png",
          media:
            "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        {
          url: "/splash/apple-splash-2208-1242.png",
          media:
            "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        {
          url: "/splash/apple-splash-1334-750.png",
          media:
            "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
        },
        {
          url: "/splash/apple-splash-1136-640.png",
          media:
            "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
        },
      ],
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
      title: ROOT_TITLE,
      description,
      url: baseUrl,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "TryVit food intelligence",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "TryVit",
      description,
      images: ["/opengraph-image"],
    },
    robots: {
      index: true,
      follow: true,
    },
    other: {
      "msapplication-TileColor": "#1DB954",
    },
    metadataBase: new URL(baseUrl),
  };
}

export function buildRootWebApplicationStructuredData(
  readiness: DeploymentReadiness,
  language: SupportedLanguage = "en",
  env: NodeJS.ProcessEnv = process.env,
) {
  if (readiness.dataBackend !== "available") return null;
  const baseUrl = publicBaseUrl(env);
  const copy = WEB_APPLICATION_COPY[language];
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${baseUrl}/#web-application`,
    name: "TryVit",
    url: baseUrl,
    description: copy.description,
    inLanguage: language,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires a modern web browser",
    isPartOf: { "@id": `${baseUrl}/#website` },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "PLN",
    },
    featureList: copy.featureList,
  } as const;
}

export function buildWebSiteStructuredData(
  readiness: DeploymentReadiness,
  env: NodeJS.ProcessEnv = process.env,
) {
  const baseUrl = publicBaseUrl(env);
  const common = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    name: "TryVit",
    url: baseUrl,
    description:
      readiness.dataBackend === "available"
        ? "Search TryVit food-product data and inspect scoring evidence."
        : "Explore TryVit food-scoring methodology while live product data is unavailable.",
  } as const;

  return readiness.dataBackend === "available"
    ? {
        ...common,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${baseUrl}/app/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      }
    : common;
}
