import en from "@/../messages/en.json";
import pl from "@/../messages/pl.json";
import de from "@/../messages/de.json";
import { translateFromMessages, type InterpolationParams } from "@/lib/i18n-format";
import type { HomeReadModel } from "@/lib/evidence/home";
import { evidenceProduct, legacyProduct } from "@/components/evidence/product-evidence.fixtures";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecentlyViewed, relativeTimeAgo } from "./RecentlyViewed";

const mockLocale = vi.hoisted(() => ({ language: "en" as "en" | "pl" | "de" }));
const dictionaries = { en, pl, de };
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    language: mockLocale.language,
    t: (key: string, params?: InterpolationParams) => translateFromMessages(dictionaries[mockLocale.language], en, key, params),
  }),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- image props are forwarded
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

const VIEWED_AT = "2026-09-04T12:00:00.000Z";
type TestOverrides = { product_name?: string; brand?: string | null; unhealthiness_score?: number | null; image_thumb_url?: string | null; viewed_at?: string };
function makeProduct(id: number, overrides: TestOverrides = {}): HomeReadModel["recently_viewed"][number] {
  const product = evidenceProduct(id);
  product.product_name = overrides.product_name ?? `Product ${id}`;
  product.brand = overrides.brand === null ? "" : overrides.brand ?? `Brand ${id}`;
  product.image = overrides.image_thumb_url ? { url: overrides.image_thumb_url, alt: "", source: "Fixture source" } : null;
  return { product_id: id, viewed_at: overrides.viewed_at ?? VIEWED_AT, product };
}

beforeEach(() => { mockLocale.language = "en"; });
afterEach(() => { vi.useRealTimers(); });

describe("relativeTimeAgo", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(VIEWED_AT)); });

  it.each([[0, "now"], [30 * 60_000, "30m"], [5 * 3_600_000, "5h"], [3 * 86_400_000, "3d"], [14 * 86_400_000, "2w"]])(
    "formats %i milliseconds ago as %s", (elapsed, label) => {
      expect(relativeTimeAgo(new Date(Date.now() - elapsed).toISOString())).toBe(label);
    },
  );

  it("treats future dates as now", () => {
    expect(relativeTimeAgo("2027-01-01T00:00:00Z")).toBe("now");
  });
});

describe("RecentlyViewed", () => {
  it("offers a real search entry point for empty history", () => {
    render(<RecentlyViewed products={[]} />);
    expect(screen.getByRole("heading", { name: "Your next find starts here." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search products" })).toHaveAttribute("href", "/app/search");
    expect(screen.queryByTestId("recently-viewed-item")).not.toBeInTheDocument();
  });

  it("shows at most five actual products in supplied history order", () => {
    const products = Array.from({ length: 8 }, (_, i) => makeProduct(i + 1));
    render(<RecentlyViewed products={products} />);
    const rows = screen.getAllByTestId("recently-viewed-item");
    expect(rows).toHaveLength(5);
    rows.forEach((row, index) => {
      expect(row).toHaveAttribute("href", `/app/product/${index + 1}`);
      expect(within(row).getByText(`Product ${index + 1}`)).toBeInTheDocument();
      expect(within(row).getByText(`Brand ${index + 1}`)).toBeInTheDocument();
    });
    expect(products).toHaveLength(8);
  });

  it.each([null, Number.NaN, -1, 0, 1, 40, 100, 101, Number.POSITIVE_INFINITY])(
    "does not surface legacy score %s in a product identity row", (score) => {
      render(<RecentlyViewed products={[makeProduct(42, { unhealthiness_score: score })]} />);
      expect(screen.getByRole("link", { name: /Product 42.*Brand 42/ })).toHaveAttribute("href", "/app/product/42");
      expect(screen.queryByText(/TryVit score|Score unavailable|higher is better/i)).not.toBeInTheDocument();
      expect(screen.queryByText("/100")).not.toBeInTheDocument();
      expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    },
  );

  it("keeps product identification when brand is missing", () => {
    render(<RecentlyViewed products={[makeProduct(1, { brand: null, unhealthiness_score: null })]} />);
    expect(screen.getByRole("link", { name: /Product 1/ })).toBeInTheDocument();
    expect(screen.queryByText("Brand 1")).not.toBeInTheDocument();
  });

  it.each([["Łaciate", "Ł"], ["  Skyr", "S"], ["🥛 Milk", "M"], ["123 cereal", "1"]])(
    "uses a decorative identity monogram for %s when no photo exists", (name, initial) => {
      render(<RecentlyViewed products={[makeProduct(1, { product_name: name })]} />);
      const row = screen.getByTestId("recently-viewed-item");
      expect(row.querySelector("img")).not.toBeInTheDocument();
      expect(within(row).getByText(initial)).toHaveAttribute("class");
      expect(within(row).getByText(initial).closest('[aria-hidden="true"]')).not.toBeNull();
    },
  );

  it("shows a supplied photo and keeps identity after an image error", () => {
    render(<RecentlyViewed products={[makeProduct(1, { image_thumb_url: "https://images.openfoodfacts.org/images/products/test.jpg" })]} />);
    const row = screen.getByTestId("recently-viewed-item");
    const image = row.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("src", "https://images.openfoodfacts.org/images/products/test.jpg");
    if (image) fireEvent.error(image);
    expect(row.querySelector("img")).not.toBeInTheDocument();
    expect(within(row).getByText("P")).toBeInTheDocument();
    expect(row).toHaveAttribute("href", "/app/product/1");
  });

  it.each(["en", "pl", "de"] as const)("renders an accessible date in %s", (language) => {
    mockLocale.language = language;
    render(<RecentlyViewed products={[makeProduct(1)]} />);
    const date = new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" }).format(new Date(VIEWED_AT));
    const time = screen.getByText(date);
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", VIEWED_AT);
    expect(time).toHaveAttribute("aria-label", translateFromMessages(dictionaries[language], en, "dashboard.home.viewedOn", { date }));
  });

  it("omits an invalid date without losing the product link", () => {
    render(<RecentlyViewed products={[makeProduct(1, { viewed_at: "invalid" })]} />);
    expect(screen.getByTestId("recently-viewed-item")).toHaveAttribute("href", "/app/product/1");
    expect(screen.getByTestId("recently-viewed-item").querySelector("time")).not.toBeInTheDocument();
  });

  it("retains a missing current product reference without inventing its identity", () => {
    render(<RecentlyViewed products={[{ product_id: 47, product: null, viewed_at: VIEWED_AT }]} />);
    expect(screen.getByRole("link", { name: /Product 47 — record unavailable/ })).toHaveAttribute("href", "/app/product/47");
    expect(screen.getByText("Saved reference retained; current product evidence unavailable.")).toBeInTheDocument();
  });

  it("shows unverified and archived state rather than a current score", () => {
    const product = legacyProduct(47); product.is_deprecated = true;
    render(<RecentlyViewed products={[{ product_id: 47, product, viewed_at: VIEWED_AT }]} />);
    expect(screen.getByText("Legacy information — sources not established")).toBeInTheDocument();
    expect(screen.getByText("Archived catalogue product")).toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("directs users to inspect available evidence without claiming verified or personalized results", () => {
    render(<RecentlyViewed products={[makeProduct(1)]} />);
    expect(screen.getByText(translateFromMessages(en, undefined, "dashboard.home.productEvidenceNote"))).toBeInTheDocument();
    expect(screen.queryByText(/verified|recommended for you|allergen-free/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View history/i })).not.toBeInTheDocument();
  });
});
