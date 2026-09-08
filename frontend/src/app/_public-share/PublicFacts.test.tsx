import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { evidenceProduct, legacyProduct } from "@/components/evidence/product-evidence.fixtures";
import { assertComponentA11y } from "@/utils/test/a11y";
import { PublicComparisonTable, PublicDataAttribution, PublicNutrient, PublicProductFacts, PublicSourceDetails } from "./PublicFacts";

describe("public factual display", () => {
  it("preserves exact decimal precision and qualifiers in localized display", () => {
    const field = { ...evidenceProduct().nutrition.salt_g, value: "0.000100000001", qualifier: "lt" as const };
    render(<PublicNutrient field={field} language="pl" />);
    expect(screen.getByText("< 0,000100000001 g")).toBeInTheDocument();
  });
  it("never turns missing or legacy evidence into a comparative result", () => {
    render(<PublicComparisonTable products={[legacyProduct(1), evidenceProduct(2)]} language="en" />);
    expect(screen.getAllByText("Not comparable with this evidence")).toHaveLength(9);
    expect(screen.queryByText("Lower recorded value")).not.toBeInTheDocument();
  });
  it("withholds incompatible, qualified and conflicting comparisons", () => {
    const a = evidenceProduct(1), b = evidenceProduct(2, { basis: "per_100ml" });
    b.evidence.state = "conflicting";
    render(<PublicComparisonTable products={[a, b]} language="en" />);
    expect(screen.getAllByText("Not comparable with this evidence")).toHaveLength(9);
  });
  it("keeps positive warnings visible without rendering package images", () => {
    const product = legacyProduct();
    product.allergens = { state: "unverified", contains: [{ name: "milk", state: "unverified", observation_id: null }], traces: [] };
    render(<PublicProductFacts product={product} language="en" />);
    expect(screen.getByText(/Contains evidence: milk/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  it("does not expose credentials in clickable source URLs", () => {
    const product = evidenceProduct();
    product.sources[0].source_url = "https://user:password@example.org";
    const { container } = render(<PublicSourceDetails product={product} language="en" />);
    expect(container.querySelector("a")).toBeNull();
    expect(container).not.toHaveTextContent("password");
  });
  it("provides database/content attribution without claiming legacy field verification", () => {
    render(<PublicDataAttribution language="en" />);
    expect(screen.getByRole("link", { name: "Open Food Facts" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "ODbL 1.0" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "DbCL 1.0" })).toBeInTheDocument();
    expect(screen.getByText(/Package photos are not reproduced/)).toBeInTheDocument();
  });
  it("has accessible table names, headers and native disclosures", async () => {
    await assertComponentA11y(<main><h1>Shared product facts</h1><PublicComparisonTable products={[evidenceProduct(1), evidenceProduct(2)]} language="en" /><PublicProductFacts product={evidenceProduct(1)} language="en" /></main>);
  });
});
