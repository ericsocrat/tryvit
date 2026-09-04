import en from "@/../messages/en.json";
import pl from "@/../messages/pl.json";
import de from "@/../messages/de.json";
import { translateFromMessages, type InterpolationParams } from "@/lib/i18n-format";
import type { RecentlyViewedProduct } from "@/lib/types";
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
function makeProduct(id: number, overrides: Partial<RecentlyViewedProduct> = {}): RecentlyViewedProduct {
  return {
    product_id: id,
    product_name: `Product ${id}`,
    brand: `Brand ${id}`,
    category: "chips",
    country: "PL",
    unhealthiness_score: 40,
    nutri_score_label: "C",
    viewed_at: VIEWED_AT,
    image_thumb_url: null,
    ...overrides,
  };
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

  it("presents the existing score conversion with explicit units and direction", () => {
    render(<RecentlyViewed products={[makeProduct(42)]} />);
    expect(screen.getByRole("link", { name: /Product 42.*TryVit score: 60 out of 100; higher is better/ })).toHaveAttribute("href", "/app/product/42");
    expect(screen.getByText("TryVit score · higher is better")).toBeInTheDocument();
    expect(screen.getByText("/100")).toBeInTheDocument();
  });

  it.each([null, Number.NaN, -1, 0, 101, Number.POSITIVE_INFINITY])("labels an unusable raw score %s as unavailable", (score) => {
    render(<RecentlyViewed products={[makeProduct(1, { unhealthiness_score: score })]} />);
    expect(screen.getByText("Score unavailable")).toBeInTheDocument();
    expect(screen.queryByText("/100")).not.toBeInTheDocument();
  });

  it.each([[100, 0], [1, 99]])("preserves boundary conversion %i to %i", (rawScore, score) => {
    render(<RecentlyViewed products={[makeProduct(1, { unhealthiness_score: rawScore })]} />);
    expect(screen.getByText(`TryVit score: ${score} out of 100; higher is better.`)).toBeInTheDocument();
  });

  it("keeps product identification when brand and score are missing", () => {
    render(<RecentlyViewed products={[makeProduct(1, { brand: null, unhealthiness_score: null })]} />);
    expect(screen.getByRole("link", { name: /Product 1.*Score unavailable/ })).toBeInTheDocument();
    expect(screen.queryByText("Brand 1")).not.toBeInTheDocument();
  });

  it("uses a decorative category icon when no product photo is available", () => {
    render(<RecentlyViewed products={[makeProduct(1)]} />);
    const row = screen.getByTestId("recently-viewed-item");
    expect(row.querySelector("img")).not.toBeInTheDocument();
    expect(row.querySelector('svg[viewBox="0 0 24 24"]')).toBeInTheDocument();
  });

  it.each([" Dairy ", "Seafood & Fish", "Chips-PL"])("normalizes database category %s to its dedicated icon", (category) => {
    render(<RecentlyViewed products={[makeProduct(1, { category })]} />);
    // Dedicated category illustrations use grouped paths; the generic utensils fallback does not.
    expect(screen.getByTestId("recently-viewed-item").querySelector("svg g")).toBeInTheDocument();
  });

  it("shows a supplied product photo and falls back to a category icon after an image error", () => {
    render(<RecentlyViewed products={[makeProduct(1, { image_thumb_url: "https://images.openfoodfacts.org/images/products/test.jpg" })]} />);
    const row = screen.getByTestId("recently-viewed-item");
    const image = row.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("src", "https://images.openfoodfacts.org/images/products/test.jpg");
    expect(image).not.toBeNull();
    if (image) fireEvent.error(image);
    expect(row.querySelector("img")).not.toBeInTheDocument();
    expect(row.querySelector('svg[viewBox="0 0 24 24"]')).toBeInTheDocument();
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

  it("directs users to inspect available evidence without claiming verified or personalized results", () => {
    render(<RecentlyViewed products={[makeProduct(1)]} />);
    expect(screen.getByText("Open a product to check ingredients, allergens and available sources.")).toBeInTheDocument();
    expect(screen.queryByText(/verified|recommended for you|allergen-free/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View history/i })).not.toBeInTheDocument();
  });
});
