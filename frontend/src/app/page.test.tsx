import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeploymentReadiness } from "@/lib/deployment-readiness";

import {
  buildLandingMetadata,
  getLandingCopy,
  getLandingMetadataCopy,
} from "./_landing-v2/copy";
import { HomePageContent } from "./HomePageContent";

vi.mock("next/font/local", () => ({
  default: () => ({ className: "font", variable: "font-variable", style: {} }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key");
  vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
});

afterEach(() => vi.unstubAllEnvs());

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

describe("production landing composition", () => {
  it("renders the route-local V2 shell, stable main marker, and complete footer", () => {
    const { container } = render(<HomePageContent language="en" />);
    expect(container.querySelector('[data-landing-shell="folded-label-register"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-route-id]")).toHaveLength(1);
    expect(container.querySelectorAll('[data-landing-lockup="horizontal"]')).toHaveLength(1);
    expect(container.querySelectorAll("[data-landing-market-descriptor]")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("main")).toHaveAttribute("data-route-id", "public-landing");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Account, service, and display" }),
    ).toBeInTheDocument();
    const primaryNavigation = screen.getByRole("navigation", { name: "Primary navigation" });
    for (const name of ["Evidence", "Method", "Trust", "Contact"]) {
      expect(within(primaryNavigation).getByRole("link", { name, exact: true })).toBeInTheDocument();
    }
    expect(screen.getByRole("navigation", { name: "Footer navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });

  it("renders localized live WebSite structured data", () => {
    const { container } = render(<HomePageContent language="pl" />);
    const structuredData = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')!.textContent!,
    );
    expect(structuredData).toMatchObject({
      "@type": "WebSite",
      "@id": "https://tryvit.vercel.app/#website",
      inLanguage: "pl",
      description: getLandingMetadataCopy("pl", live).description,
    });
    expect(structuredData.potentialAction.target.urlTemplate).toContain("/app/search");
  });

  it("keeps demo mode backend-independent and removes live structured actions", () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "demo");
    const { container } = render(<HomePageContent language="de" />);
    expect(
      screen.getByRole("heading", {
        name: "Die Website ist verfügbar; Live-Produktdaten sind pausiert",
      }),
    ).toBeInTheDocument();
    const structuredData = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')!.textContent!,
    );
    expect(structuredData.potentialAction).toBeUndefined();
    expect(structuredData.inLanguage).toBe("de");
    expect(structuredData.description).toBe(getLandingMetadataCopy("de", demo).description);
  });
});

describe("localized landing metadata", () => {
  it.each([
    ["en" as const, live, "live", "en_US"],
    ["en" as const, demo, "demo", "en_US"],
    ["pl" as const, live, "live", "pl_PL"],
    ["pl" as const, demo, "demo", "pl_PL"],
    ["de" as const, live, "live", "de_DE"],
    ["de" as const, demo, "demo", "de_DE"],
  ])("builds absolute $0 metadata in $2 readiness", (language, readiness, mode, locale) => {
    const copy = getLandingCopy(language);
    const expected = getLandingMetadataCopy(language, readiness);
    const metadata = buildLandingMetadata(language, readiness);
    expect(metadata.title).toEqual({ absolute: copy.metadata.title });
    expect(metadata.description).toBe(expected.description);
    expect((metadata.openGraph as { title: string }).title).toBe(copy.metadata.title);
    expect((metadata.openGraph as { description: string }).description).toBe(
      expected.socialDescription,
    );
    expect((metadata.openGraph as { images: string[] }).images).toEqual([
      "/opengraph-image",
    ]);
    expect((metadata.openGraph as Record<string, unknown>).locale).toBe(locale);
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: copy.metadata.title,
      description: expected.socialDescription,
      images: ["/twitter-image"],
    });
    expect(JSON.stringify(metadata)).not.toMatch(/instantly|science-driven|health score/iu);
    if (mode === "demo") {
      expect(`${metadata.description} ${expected.socialDescription}`).toMatch(
        /paused|wstrzymane|pausiert/iu,
      );
    }
  });
});
