import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomePageContent } from "./HomePageContent";
import { buildLandingMetadata } from "./_landing-v2/copy";

vi.mock("next/font/local", () => ({
  default: () => ({ className: "font", variable: "font-variable", style: {} }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key");
  vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production landing composition", () => {
  it("renders the route-local V2 shell, main landmark, and complete footer", () => {
    const { container } = render(<HomePageContent language="en" />);
    expect(container.querySelector('[data-landing-shell="folded-label-register"]')).not.toBeNull();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });

  it("renders localized WebSite structured data", () => {
    const { container } = render(<HomePageContent language="pl" />);
    const structuredData = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')!.textContent!,
    );
    expect(structuredData["@type"]).toBe("WebSite");
    expect(structuredData.inLanguage).toBe("pl");
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
  });
});

describe("localized landing metadata", () => {
  it.each([
    ["en" as const, "TryVit — Food intelligence you can inspect", "en_US"],
    ["pl" as const, "TryVit — dane o żywności, które można sprawdzić", "pl_PL"],
    ["de" as const, "TryVit — nachprüfbare Lebensmittelinformation", "de_DE"],
  ])("builds %s metadata", (language, title, locale) => {
    const metadata = buildLandingMetadata(language);
    expect(metadata.title).toBe(title);
    expect(metadata.description).toBeTruthy();
    expect((metadata.openGraph as Record<string, unknown>).locale).toBe(locale);
    expect((metadata.twitter as Record<string, unknown>).card).toBe("summary_large_image");
  });
});
