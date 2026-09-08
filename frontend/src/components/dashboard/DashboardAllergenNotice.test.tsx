import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { evidenceProduct, legacyProduct } from "@/components/evidence/product-evidence.fixtures";
import type { SavedAllergenMatches } from "@/lib/evidence/home";
import { DashboardAllergenNotice } from "./DashboardAllergenNotice";

function matches(): SavedAllergenMatches {
  const source = evidenceProduct(1), legacy = legacyProduct(2);
  return { state: "checked", count: 2, includes_traces: true, products: [
    { product_id: 1, product: source, matches: [{ allergen: "milk", kind: "contains", state: "recorded", observation_id: source.sources[0].observation_id }] },
    { product_id: 2, product: legacy, matches: [{ allergen: "sesame", kind: "traces", state: "unverified", observation_id: null }] },
  ] };
}
describe("same-response saved allergen notice", () => {
  it("announces positive evidence without ranking or claiming safety", async () => {
    render(<DashboardAllergenNotice matches={matches()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("2 products in Favorites have positive evidence");
    expect(screen.getByRole("alert")).toHaveTextContent("older unverified records");
    await userEvent.click(screen.getByText("Inspect recorded matches"));
    expect(screen.getByText("Milk (contains)")).toBeInTheDocument();
    expect(screen.getByText("Sesame (may contain)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fixture product 1" })).toHaveAttribute("href", "/app/product/1");
    expect(screen.getByText(/May-contain evidence is included/)).toBeInTheDocument();
  });
  it("does not convert zero recorded matches into absence or suitability", () => {
    render(<DashboardAllergenNotice matches={{ state: "checked", count: 0, includes_traces: false, products: [] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("This does not establish allergen absence or suitability");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("does not fabricate an assessed count when preferences are unavailable", () => {
    render(<DashboardAllergenNotice matches={{ state: "preferences_unavailable", count: null, includes_traces: false, products: [] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("could not be refreshed");
    expect(screen.queryByText(/No matching positive/)).not.toBeInTheDocument();
  });
  it("preserves earlier positive warnings if a background refresh fails", () => {
    render(<DashboardAllergenNotice matches={matches()} stale />);
    expect(screen.getByRole("alert")).toHaveTextContent("2 products");
    expect(screen.getByRole("status")).toHaveTextContent("Earlier positive warnings remain visible");
  });
  it("does not repeat a stale zero-match conclusion during failed refresh", () => {
    render(<DashboardAllergenNotice matches={{ state: "checked", count: 0, includes_traces: false, products: [] }} stale />);
    expect(screen.getByRole("status")).toHaveTextContent("could not be refreshed");
    expect(screen.queryByText(/No matching positive/)).not.toBeInTheDocument();
  });
  it("does not show an unnecessary notice when no avoided allergens are configured", () => {
    const { container } = render(<DashboardAllergenNotice matches={{ state: "not_configured", count: null, includes_traces: false, products: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("makes bounded previews visible without claiming they are the complete count", async () => {
    render(<DashboardAllergenNotice matches={{ ...matches(), count: 7 }} />);
    await userEvent.click(screen.getByText("Inspect recorded matches"));
    expect(screen.getByText("Showing 2 of 7 matching products.")).toBeInTheDocument();
  });
});
