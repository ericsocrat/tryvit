import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductThumbnail } from "./ProductThumbnail";

// ─── Mock Next/Image so we can inspect src/alt props ───────────────────────

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// ─── Mock CategoryIcon ─────────────────────────────────────────────────────

vi.mock("@/components/common/CategoryIcon", () => ({
  CategoryIcon: ({ slug }: { slug: string }) => (
    <span data-testid="category-icon">{slug}</span>
  ),
  hasCategoryIcon: (slug: string) =>
    ["dairy", "bread", "meat"].includes(slug),
}));

describe("ProductThumbnail", () => {
  // ── Image rendering ───────────────────────────────────────────────────────

  it("renders an image when imageUrl is provided", () => {
    render(
      <ProductThumbnail
        imageUrl="https://images.openfoodfacts.org/test.jpg"
        productName="Milk"
      />,
    );

    const img = screen.getByAltText("Milk");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe(
      "https://images.openfoodfacts.org/test.jpg",
    );
  });

  it("renders the data-testid wrapper", () => {
    render(
      <ProductThumbnail imageUrl={null} productName="Cheese" />,
    );
    expect(screen.getByTestId("product-thumbnail")).toBeTruthy();
  });

  // ── Fallback: null URL ────────────────────────────────────────────────────

  it("renders category emoji fallback when imageUrl is null", () => {
    render(
      <ProductThumbnail
        imageUrl={null}
        productName="Butter"
        categoryIcon="🧈"
      />,
    );

    expect(screen.queryByRole("img")).toBeFalsy();
    expect(screen.getByText("🧈")).toBeTruthy();
  });

  it("renders default 📦 fallback when no category info", () => {
    render(
      <ProductThumbnail imageUrl={null} productName="Unknown Product" />,
    );

    expect(screen.getByText("📦")).toBeTruthy();
  });

  it("renders CategoryIcon when categorySlug has a dedicated icon", () => {
    render(
      <ProductThumbnail
        imageUrl={null}
        productName="Milk"
        categorySlug="dairy"
      />,
    );

    expect(screen.getByTestId("category-icon")).toBeTruthy();
    expect(screen.getByTestId("category-icon").textContent).toBe("dairy");
  });

  it("normalizes display-style category names before resolving an icon", () => {
    render(
      <ProductThumbnail
        imageUrl={null}
        productName="Milk"
        categorySlug=" Dairy "
      />,
    );

    expect(screen.getByTestId("category-icon")).toHaveTextContent("dairy");
  });

  it("prefers CategoryIcon over emoji when both provided", () => {
    render(
      <ProductThumbnail
        imageUrl={null}
        productName="Bread"
        categorySlug="bread"
        categoryIcon="🍞"
      />,
    );

    expect(screen.getByTestId("category-icon")).toBeTruthy();
    expect(screen.queryByText("🍞")).toBeFalsy();
  });

  it("falls back to emoji when categorySlug has no dedicated icon", () => {
    render(
      <ProductThumbnail
        imageUrl={null}
        productName="Exotic Fruit"
        categorySlug="exotic-fruit"
        categoryIcon="🥭"
      />,
    );

    expect(screen.queryByTestId("category-icon")).toBeFalsy();
    expect(screen.getByText("🥭")).toBeTruthy();
  });

  // ── Fallback: image load error ────────────────────────────────────────────

  it("falls back to category icon on image load error", () => {
    render(
      <ProductThumbnail
        imageUrl="https://images.openfoodfacts.org/broken.jpg"
        productName="Broken Image"
        categoryIcon="🥛"
      />,
    );

    // Image should initially render
    const img = screen.getByAltText("Broken Image");
    expect(img).toBeTruthy();

    // Simulate error
    fireEvent.error(img);

    // Should now show fallback
    expect(screen.queryByAltText("Broken Image")).toBeFalsy();
    expect(screen.getByText("🥛")).toBeTruthy();
  });

  // ── Sizes ─────────────────────────────────────────────────────────────────

  it("applies sm size classes by default", () => {
    render(
      <ProductThumbnail imageUrl={null} productName="Small" />,
    );

    const container = screen.getByTestId("product-thumbnail");
    expect(container.className).toContain("h-12");
    expect(container.className).toContain("w-12");
  });

  it("applies md size classes", () => {
    render(
      <ProductThumbnail imageUrl={null} productName="Medium" size="md" />,
    );

    const container = screen.getByTestId("product-thumbnail");
    expect(container.className).toContain("h-16");
    expect(container.className).toContain("w-16");
  });

  it("applies lg size classes", () => {
    render(
      <ProductThumbnail imageUrl={null} productName="Large" size="lg" />,
    );

    const container = screen.getByTestId("product-thumbnail");
    expect(container.className).toContain("h-20");
    expect(container.className).toContain("w-20");
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  it("has aria-label on fallback indicating no image", () => {
    render(
      <ProductThumbnail imageUrl={null} productName="Cheese" />,
    );

    expect(
      screen.getByLabelText("Cheese — no image available"),
    ).toBeTruthy();
  });

  it("uses product name as alt text for image", () => {
    render(
      <ProductThumbnail
        imageUrl="https://images.openfoodfacts.org/x.jpg"
        productName="Gouda Cheese"
      />,
    );

    expect(screen.getByAltText("Gouda Cheese")).toBeTruthy();
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("treats undefined imageUrl same as null", () => {
    render(
      <ProductThumbnail
        imageUrl={undefined}
        productName="No Image"
        categoryIcon="📦"
      />,
    );

    expect(screen.queryByRole("img")).toBeFalsy();
    expect(screen.getByText("📦")).toBeTruthy();
  });

  it("treats empty string imageUrl same as null", () => {
    render(
      <ProductThumbnail
        imageUrl=""
        productName="Empty URL"
        categoryIcon="🍕"
      />,
    );

    expect(screen.queryByRole("img")).toBeFalsy();
    expect(screen.getByText("🍕")).toBeTruthy();
  });
});
