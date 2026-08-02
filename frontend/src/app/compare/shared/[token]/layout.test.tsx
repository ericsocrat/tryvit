import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SharedComparisonLayout, { generateMetadata } from "./layout";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockParams = (token: string) => ({ params: Promise.resolve({ token }) });
const compareProduct = (productName: string, productId: number) => ({
  product_id: productId,
  ean: null,
  product_name: productName,
  brand: "Example brand",
  category: "Snacks",
  category_display: "Snacks",
  category_icon: "📦",
  unhealthiness_score: 42,
  score_band: "moderate",
  nutri_score: "C",
  nova_group: "3",
  processing_risk: "moderate",
  calories: 123,
  total_fat_g: 4,
  saturated_fat_g: 1,
  trans_fat_g: null,
  carbs_g: 20,
  sugars_g: 3,
  fibre_g: null,
  protein_g: 5,
  salt_g: 0.4,
  high_salt: false,
  high_sugar: false,
  high_sat_fat: false,
  high_additive_load: false,
  additives_count: 0,
  ingredient_count: 4,
  allergen_count: 0,
  allergen_tags: null,
  trace_tags: null,
  confidence: "high",
  data_completeness_pct: 100,
});
const sharedComparisonPayload = (productNames: string[]) => ({
  api_version: "1.0",
  comparison_id: "comparison-id",
  title: null,
  product_count: productNames.length,
  created_at: "2026-08-02T00:00:00Z",
  products: productNames.map(compareProduct),
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  vi.restoreAllMocks();
});

// ─── Rendering ───────────────────────────────────────────────────────────────

describe("SharedComparisonLayout", () => {
  it("renders children unchanged", () => {
    render(
      <SharedComparisonLayout>
        <p>comparison content</p>
      </SharedComparisonLayout>,
    );
    expect(screen.getByText("comparison content")).toBeInTheDocument();
  });
});

// ─── generateMetadata ────────────────────────────────────────────────────────

describe("generateMetadata", () => {
  it("returns dynamic title with product names when fetch succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sharedComparisonPayload(["Doritos", "Lay's"])),
      }),
    );

    const metadata = await generateMetadata(mockParams("abc123"));
    expect(metadata.title).toBe("Compare: Doritos vs Lay's");
    expect(metadata.description).toContain("Doritos");
    expect(metadata.description).toContain("Lay's");
  });

  it("returns fallback title when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const metadata = await generateMetadata(mockParams("bad-token"));
    expect(metadata.title).toBe("Product Comparison — TryVit");
  });

  it("returns fallback title when env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const metadata = await generateMetadata(mockParams("abc123"));
    expect(metadata.title).toBe("Product Comparison — TryVit");
  });

  it("always sets robots noindex and nofollow", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sharedComparisonPayload(["A", "B"])),
      }),
    );

    const metadata = await generateMetadata(mockParams("abc123"));
    const robots = metadata.robots as Record<string, unknown>;
    expect(robots.index).toBe(false);
    expect(robots.follow).toBe(false);

    const googleBot = robots.googleBot as Record<string, unknown>;
    expect(googleBot.index).toBe(false);
    expect(googleBot.follow).toBe(false);
  });

  it("includes openGraph fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sharedComparisonPayload(["Alpha", "Beta"])),
      }),
    );

    const metadata = await generateMetadata(mockParams("abc123"));
    const og = metadata.openGraph as Record<string, unknown>;
    expect(og.title).toBe("Compare: Alpha vs Beta");
    expect(og.siteName).toBe("TryVit");
    expect(og.type).toBe("website");
  });

  it("truncates to 3 product names when more than 3 products", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sharedComparisonPayload(["A", "B", "C", "D"])),
      }),
    );

    const metadata = await generateMetadata(mockParams("abc123"));
    expect(metadata.title).toBe("Compare: A vs B vs C");
  });
});
