import type { RecentlyViewedProduct } from "@/lib/types";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecentlyViewed, relativeTimeAgo } from "./RecentlyViewed";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "dashboard.recentlyViewedCompact": "Recently Viewed",
        "dashboard.viewAll": "View all",
        "dashboard.viewHistory": "View history",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- alt is forwarded via {...props}
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProduct(
  id: number,
  overrides: Partial<RecentlyViewedProduct> = {},
): RecentlyViewedProduct {
  return {
    product_id: id,
    product_name: `Product ${id}`,
    brand: `Brand ${id}`,
    category: "chips",
    country: "PL",
    unhealthiness_score: 40,
    nutri_score_label: "C",
    viewed_at: new Date().toISOString(),
    image_thumb_url: null,
    ...overrides,
  };
}

// ─── relativeTimeAgo unit tests ─────────────────────────────────────────────

describe("relativeTimeAgo", () => {
  it("returns 'now' for current time", () => {
    expect(relativeTimeAgo(new Date().toISOString())).toBe("now");
  });

  it("returns minutes for < 1 hour", () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    expect(relativeTimeAgo(thirtyMinAgo)).toBe("30m");
  });

  it("returns hours for < 24 hours", () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 3600_000).toISOString();
    expect(relativeTimeAgo(fiveHoursAgo)).toBe("5h");
  });

  it("returns days for < 7 days", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString();
    expect(relativeTimeAgo(threeDaysAgo)).toBe("3d");
  });

  it("returns weeks for >= 7 days", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
    expect(relativeTimeAgo(twoWeeksAgo)).toBe("2w");
  });
});

// ─── RecentlyViewed component tests ─────────────────────────────────────────

describe("RecentlyViewed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for empty products", () => {
    const { container } = render(<RecentlyViewed products={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders product names and brands", () => {
    const products = [makeProduct(1), makeProduct(2)];
    render(<RecentlyViewed products={products} />);

    expect(screen.getByText("Product 1")).toBeInTheDocument();
    expect(screen.getByText("Brand 1")).toBeInTheDocument();
    expect(screen.getByText("Product 2")).toBeInTheDocument();
  });

  it("limits to 5 items", () => {
    const products = Array.from({ length: 8 }, (_, i) => makeProduct(i + 1));
    render(<RecentlyViewed products={products} />);

    const items = screen.getAllByTestId("recently-viewed-item");
    expect(items).toHaveLength(5);
  });

  it("shows TryVit scores in score circles", () => {
    // unhealthiness 40 → TryVit 60
    const products = [makeProduct(1, { unhealthiness_score: 40 })];
    render(<RecentlyViewed products={products} />);

    const item = screen.getByTestId("recently-viewed-item");
    expect(item.textContent).toContain("60");
  });

  it("shows dash for null scores", () => {
    const products = [makeProduct(1, { unhealthiness_score: null })];
    render(<RecentlyViewed products={products} />);

    const item = screen.getByTestId("recently-viewed-item");
    expect(item.textContent).toContain("–");
  });

  it("links to product pages", () => {
    const products = [makeProduct(42)];
    render(<RecentlyViewed products={products} />);

    const link = screen.getByTestId("recently-viewed-item");
    expect(link).toHaveAttribute("href", "/app/product/42");
  });

  it("shows View history link", () => {
    const products = [makeProduct(1)];
    render(<RecentlyViewed products={products} />);

    const link = screen.getByRole("link", { name: /View history/ });
    expect(link).toHaveAttribute("href", "/app/search");
  });

  it("renders a single arrow icon in View history link (no text arrow)", () => {
    const products = [makeProduct(1)];
    render(<RecentlyViewed products={products} />);

    const link = screen.getByRole("link", { name: /View history/ });
    expect(link.querySelector("svg")).toBeInTheDocument();
    expect(link.textContent).not.toContain("\u2192");
  });

  it("has section aria-label", () => {
    const products = [makeProduct(1)];
    render(<RecentlyViewed products={products} />);
    expect(screen.getByLabelText("Recently Viewed")).toBeInTheDocument();
  });

  it("hides brand when null", () => {
    const products = [makeProduct(1, { brand: null })];
    render(<RecentlyViewed products={products} />);

    expect(screen.getByText("Product 1")).toBeInTheDocument();
    expect(screen.queryByText("Brand 1")).not.toBeInTheDocument();
  });

  // ─── Image / badge / animation enrichment tests ─────────────────────────

  it("renders product image when image_thumb_url is provided", () => {
    const products = [
      makeProduct(1, {
        image_thumb_url: "https://images.openfoodfacts.org/images/products/test.jpg",
      }),
    ];
    render(<RecentlyViewed products={products} />);

    const img = screen.getByAltText("Product 1");
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute(
      "src",
      "https://images.openfoodfacts.org/images/products/test.jpg",
    );
  });

  it("renders initial fallback when no image", () => {
    const products = [makeProduct(1, { image_thumb_url: null })];
    render(<RecentlyViewed products={products} />);

    // Score circle shows TryVit score (unhealthiness 40 → TryVit 60)
    const item = screen.getByTestId("recently-viewed-item");
    expect(item.textContent).toContain("60");
    // No <img> with product alt text
    expect(screen.queryByAltText("Product 1")).not.toBeInTheDocument();
  });

  it("renders NutriScoreBadge when nutri_score_label is present", () => {
    const products = [makeProduct(1, { nutri_score_label: "C" })];
    render(<RecentlyViewed products={products} />);

    expect(screen.getByLabelText("Nutri-Score C")).toBeInTheDocument();
  });

  it("omits NutriScoreBadge when nutri_score_label is null", () => {
    const products = [makeProduct(1, { nutri_score_label: null })];
    render(<RecentlyViewed products={products} />);

    expect(screen.queryByLabelText(/Nutri-Score/)).not.toBeInTheDocument();
  });

  it("renders time as styled pill", () => {
    const products = [makeProduct(1)];
    render(<RecentlyViewed products={products} />);

    const timePill = screen.getByText("now");
    expect(timePill).toBeInTheDocument();
    expect(timePill.className).toContain("rounded-full");
    expect(timePill.className).toContain("bg-surface-secondary");
  });

  it("applies staggered slide-in-right animation delays", () => {
    const products = [makeProduct(1), makeProduct(2), makeProduct(3)];
    render(<RecentlyViewed products={products} />);

    const items = screen.getAllByTestId("recently-viewed-item");
    expect(items).toHaveLength(3);

    items.forEach((link, i) => {
      // The animated wrapper is the parent <div> of the <a> link
      const wrapper = link.parentElement as HTMLElement;
      expect(wrapper.className).toContain("animate-slide-in-right");
      expect(wrapper.style.animationDelay).toBe(`${i * 30}ms`);
    });
  });
});
