import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IngredientProductList } from "./IngredientProductList";
import type { LinkedProduct } from "@/lib/types";

const products: LinkedProduct[] = [
  { product_id: 2, product_name: "Zulu Oats", brand: "Brand", unhealthiness_score: 1, image_url: null, is_primary: true, match_confidence: 0.99 },
  { product_id: 1, product_name: "Alpha Oats", brand: null, unhealthiness_score: 90, image_url: null, is_primary: false, match_confidence: 0.1 },
];
describe("IngredientProductList evidence boundary", () => {
  it("renders nothing for no stored links", () => {
    const { container } = render(<IngredientProductList products={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("uses an accessible collapsed control without guessing recommendation quality", async () => {
    render(<IngredientProductList products={products} />);
    const toggle = screen.getByRole("button", { name: "2 products available" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Stored catalogue links, not verified/)).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/app/product/1", "/app/product/2"]);
    expect(screen.queryByText("Recommended")).not.toBeInTheDocument();
    expect(screen.queryByText("99%")).not.toBeInTheDocument();
    expect(screen.queryByText("90")).not.toBeInTheDocument();
    expect(products[0].product_name).toBe("Zulu Oats");
    await userEvent.click(toggle);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("preserves product identity and optional brand without inventing image evidence", async () => {
    render(<IngredientProductList products={products} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("link", { name: "Zulu Oats Brand" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alpha Oats" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
