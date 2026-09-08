import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductThumbnail } from "./ProductThumbnail";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

describe("ProductThumbnail", () => {
  it("renders an available photo with product identity as alternative text", () => {
    render(<ProductThumbnail imageUrl="https://images.openfoodfacts.org/photo.jpg" productName="Milk" />);
    expect(screen.getByRole("img", { name: "Milk" })).toHaveAttribute("src", "https://images.openfoodfacts.org/photo.jpg");
    expect(screen.getByRole("img")).toHaveAttribute("width", "48");
  });
  it.each([null, undefined, ""])("shows a labelled monogram for unavailable URL %s", (imageUrl) => {
    const { container } = render(<ProductThumbnail imageUrl={imageUrl} productName="Butter" categoryIcon="🧈" categorySlug="dairy" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Butter — Product photo unavailable" })).toBeInTheDocument();
    expect(screen.getByText("B")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByText("🧈")).not.toBeInTheDocument();
  });
  it.each([[" Żyto", "Ż"], ["🥛 Milk", "M"], ["6 grain bread", "6"], ["", "?"]])("handles Unicode and missing names: %s", (productName, initial) => {
    render(<ProductThumbnail imageUrl={null} productName={productName} />);
    expect(screen.getByText(initial)).toBeInTheDocument();
  });
  it("recovers when a different source photo becomes available after an error", () => {
    const { rerender } = render(<ProductThumbnail imageUrl="https://images.openfoodfacts.org/old.jpg" productName="Milk" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("M")).toBeInTheDocument();
    rerender(<ProductThumbnail imageUrl="https://images.openfoodfacts.org/new.jpg" productName="Milk" />);
    expect(screen.getByRole("img", { name: "Milk" })).toHaveAttribute("src", "https://images.openfoodfacts.org/new.jpg");
  });
  it.each([["sm", 48, "h-12"], ["md", 64, "h-16"], ["lg", 80, "h-20"]] as const)("retains explicit %s thumbnail geometry", (size, pixels, className) => {
    render(<ProductThumbnail imageUrl="https://images.openfoodfacts.org/photo.jpg" productName="Product" size={size} />);
    expect(screen.getByTestId("product-thumbnail")).toHaveClass(className);
    expect(screen.getByRole("img")).toHaveAttribute("width", String(pixels));
    expect(screen.getByRole("img")).toHaveAttribute("height", String(pixels));
  });
});
