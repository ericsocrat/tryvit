import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildLandingMetadata } from "./_landing-v2/copy";
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

describe("production landing composition", () => {
  it("renders the route-local V2 shell, stable main marker, and complete footer", () => {
    const { container } = render(<HomePageContent language="en" />);
    expect(container.querySelector('[data-landing-shell="folded-label-register"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-route-id]")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("main")).toHaveAttribute("data-route-id", "public-landing");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
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
  });
});

describe("localized landing metadata", () => {
  it.each([
    ["en" as const, "TryVit — Food intelligence you can inspect", "en_US"],
    ["pl" as const, "TryVit — dane o żywności, które można sprawdzić", "pl_PL"],
    ["de" as const, "TryVit — nachprüfbare Lebensmittelinformation", "de_DE"],
  ])("builds absolute %s metadata", (language, title, locale) => {
    const metadata = buildLandingMetadata(language);
    expect(metadata.title).toEqual({ absolute: title });
    expect(metadata.description).toBeTruthy();
    expect((metadata.openGraph as Record<string, unknown>).locale).toBe(locale);
    expect((metadata.twitter as Record<string, unknown>).card).toBe("summary_large_image");
  });
});
