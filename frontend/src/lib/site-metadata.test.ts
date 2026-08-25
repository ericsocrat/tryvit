import { describe, expect, it } from "vitest";

import type { DeploymentReadiness } from "./deployment-readiness";
import {
  buildLandingMetadata,
  buildRootMetadata,
  buildRootWebApplicationStructuredData,
  buildWebSiteStructuredData,
} from "./site-metadata";

const live: DeploymentReadiness = {
  application: "available",
  dataBackend: "available",
  fullProduct: "ready",
  mode: "live",
};
const demo: DeploymentReadiness = {
  application: "available",
  dataBackend: "unavailable",
  fullProduct: "not_ready",
  mode: "demo",
};
const publicEnvironment: NodeJS.ProcessEnv = {
  NEXT_PUBLIC_APP_URL: "https://example.test/nested-path",
};

describe("readiness-aware public metadata", () => {
  it("keeps live root metadata truthful without instant or science-driven claims", () => {
    const metadata = buildRootMetadata(live, publicEnvironment);
    expect(metadata).toMatchObject({
      manifest: "/manifest.webmanifest",
      appleWebApp: { capable: true, title: "TryVit" },
      description:
        "Search food products, scan barcodes, and inspect TryVit scoring evidence for foods sold in Poland.",
    });
    expect(metadata.metadataBase?.toString()).toBe("https://example.test/");
    expect(JSON.stringify(metadata)).not.toMatch(/instantly|science-driven|health score/iu);
  });

  it("keeps the public PWA discoverable while paused and states that live data is unavailable", () => {
    const metadata = buildRootMetadata(demo, publicEnvironment);
    expect(metadata).toMatchObject({
      manifest: "/manifest.webmanifest",
      appleWebApp: { capable: true, title: "TryVit" },
    });
    expect(metadata.description).toContain("Live product data is currently unavailable");
    expect((metadata.openGraph as { description: string }).description).toBe(
      metadata.description,
    );
    expect((metadata.twitter as { description: string }).description).toBe(
      metadata.description,
    );
    expect(JSON.stringify(metadata)).not.toMatch(/instantly|science-driven|health score/iu);
  });

  it("emits WebApplication only when the data backend is available", () => {
    expect(buildRootWebApplicationStructuredData(demo, publicEnvironment)).toBeNull();
    const structuredData = buildRootWebApplicationStructuredData(live, publicEnvironment);
    expect(structuredData).toMatchObject({
      "@type": "WebApplication",
      "@id": "https://example.test/#web-application",
      isPartOf: { "@id": "https://example.test/#website" },
      applicationCategory: "LifestyleApplication",
      featureList: ["Food product search", "Barcode scanning", "Product scoring evidence"],
    });
    expect(JSON.stringify(structuredData)).not.toMatch(/instantly|science-driven|health score/iu);
  });

  it("keeps WebSite and WebApplication identities complementary rather than duplicate", () => {
    const website = buildWebSiteStructuredData(live, publicEnvironment);
    const application = buildRootWebApplicationStructuredData(live, publicEnvironment)!;
    expect(website["@id"]).toBe("https://example.test/#website");
    expect(application["@id"]).not.toBe(website["@id"]);
    expect(application.isPartOf["@id"]).toBe(website["@id"]);
    expect(website).toHaveProperty("potentialAction.@type", "SearchAction");
  });

  it("removes readiness-specific WebSite actions in demo mode", () => {
    const website = buildWebSiteStructuredData(demo, publicEnvironment);
    expect(website).not.toHaveProperty("potentialAction");
    expect(website.description).toContain("live product data is unavailable");
  });

  it.each([live, demo])("uses one absolute landing title in $mode mode", (readiness) => {
    const metadata = buildLandingMetadata(readiness);
    expect(metadata.title).toEqual({ absolute: "TryVit — Know What You Eat" });
    expect((metadata.openGraph as { title: string }).title).toBe("TryVit — Know What You Eat");
    expect((metadata.twitter as { title: string }).title).toBe("TryVit — Know What You Eat");
  });
});
