import { assertComponentA11y } from "@/utils/test/a11y";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryPlaceholder } from "./CategoryPlaceholder";

describe("CategoryPlaceholder", () => {
  it("renders the category icon", () => {
    render(<CategoryPlaceholder icon="🍕" productName="Test Pizza" />);
    expect(screen.getByText("🍕")).toBeTruthy();
  });

  it("exposes the placeholder as an image with the product label", () => {
    render(<CategoryPlaceholder icon="🧀" productName="Cheese Snack" />);
    expect(
      screen.getByRole("img", {
        name: "Cheese Snack — no image available",
      }),
    ).toBeInTheDocument();
  });

  it("passes axe with its labelled image semantics", async () => {
    await assertComponentA11y(<CategoryPlaceholder icon="🧀" productName="Cheese Snack" />);
  });

  it("applies sm size class", () => {
    const { container } = render(<CategoryPlaceholder icon="📦" productName="Box" size="sm" />);
    const el = container.firstElementChild!;
    expect(el.className).toContain("h-10");
    expect(el.className).toContain("w-10");
  });

  it("applies lg size class", () => {
    const { container } = render(<CategoryPlaceholder icon="📦" productName="Box" size="lg" />);
    const el = container.firstElementChild!;
    expect(el.className).toContain("h-32");
    expect(el.className).toContain("w-full");
    expect(el.className).toContain("max-w-xs");
  });

  it("defaults to md size", () => {
    const { container } = render(<CategoryPlaceholder icon="📦" productName="Box" />);
    const el = container.firstElementChild!;
    expect(el.className).toContain("h-16");
    expect(el.className).toContain("w-16");
  });

  it("renders Lucide icon when categorySlug is provided", () => {
    const { container } = render(
      <CategoryPlaceholder icon="🧀" productName="Cheese" categorySlug="dairy" />,
    );
    // Lucide icon renders as SVG instead of emoji text
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.textContent).not.toContain("🧀");
  });

  it("falls back to emoji when categorySlug is not recognized", () => {
    render(<CategoryPlaceholder icon="🍕" productName="Pizza" categorySlug="unknown-category" />);
    expect(screen.getByText("🍕")).toBeTruthy();
  });

  it("falls back to emoji when categorySlug is omitted", () => {
    render(<CategoryPlaceholder icon="🍕" productName="Pizza" />);
    expect(screen.getByText("🍕")).toBeTruthy();
  });
});
