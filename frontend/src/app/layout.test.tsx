import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RootLayout, { generateMetadata } from "./layout";

const { mockGetServerLocale, mockHeaders } = vi.hoisted(() => ({
  mockGetServerLocale: vi.fn(),
  mockHeaders: vi.fn(),
}));

vi.mock("@/lib/server-locale", () => ({
  getServerLocale: mockGetServerLocale,
}));

vi.mock("next/headers", () => ({ headers: mockHeaders }));

beforeEach(() => mockHeaders.mockResolvedValue(new Headers()));

describe("RootLayout document language", () => {
  it.each(["en", "pl", "de"] as const)(
    "renders html[lang=%s] from the server locale",
    async (language) => {
      mockGetServerLocale.mockResolvedValueOnce(language);
      const result = await RootLayout({ children: <main>Content</main> });
      expect(result.props.lang).toBe(language);
      expect(result.props["data-design-system"]).toBe("v1");
    },
  );

  it("uses the lean provider boundary only for an exact landing request", async () => {
    mockGetServerLocale.mockResolvedValueOnce("en");
    mockHeaders.mockResolvedValueOnce(
      new Headers({ "x-tryvit-provider-boundary": "landing-lean" }),
    );

    const result = await RootLayout({ children: <main>Content</main> });
    expect(result.props.children[1].props["data-provider-boundary"]).toBe("landing");
  });
});

describe("RootLayout metadata readiness", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("publishes live capability metadata only with complete readiness", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key");
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
    expect(generateMetadata().description).toContain("scan barcodes");
  });

  it("publishes an explicit paused description in demo mode", () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "demo");
    expect(generateMetadata().description).toContain(
      "Live product data is currently unavailable",
    );
  });
});
