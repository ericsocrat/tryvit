import type { CompareProduct, ProductProvenance } from "@/lib/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComparisonGrid } from "./ComparisonGrid";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/components/product/AvoidBadge", () => ({
  AvoidBadge: ({ productId }: { productId: number }) => (
    <span data-testid={`avoid-badge-${productId}`}>avoid</span>
  ),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const makeProduct = (
  overrides: Partial<CompareProduct> = {},
): CompareProduct => ({
  product_id: 1,
  ean: "1234567890123",
  product_name: "Product A",
  brand: "Brand A",
  category: "chips",
  category_display: "Chips",
  category_icon: "🍟",
  unhealthiness_score: 35,
  score_band: "moderate",
  nutri_score: "C",
  nova_group: "3",
  processing_risk: "moderate",
  calories: 500,
  total_fat_g: 25,
  saturated_fat_g: 10,
  trans_fat_g: 0.5,
  carbs_g: 55,
  sugars_g: 5,
  fibre_g: 3,
  protein_g: 7,
  salt_g: 1.2,
  high_salt: true,
  high_sugar: false,
  high_sat_fat: false,
  high_additive_load: false,
  additives_count: 3,
  ingredient_count: 12,
  allergen_count: 2,
  allergen_tags: "gluten, milk",
  trace_tags: null,
  confidence: "high",
  data_completeness_pct: 85,
  ...overrides,
});

const productA = makeProduct();

const productB = makeProduct({
  product_id: 2,
  product_name: "Product B",
  brand: "Brand B",
  unhealthiness_score: 60,
  score_band: "high",
  nutri_score: "D",
  nova_group: "4",
  calories: 600,
  total_fat_g: 30,
  saturated_fat_g: 15,
  sugars_g: 20,
  salt_g: 2.5,
  fibre_g: 1,
  protein_g: 4,
  high_salt: true,
  high_sugar: true,
  high_sat_fat: true,
  high_additive_load: true,
  additives_count: 8,
  allergen_count: 0,
  allergen_tags: null,
  confidence: "medium",
});

const products = [productA, productB];

function scoreOnlyProvenance(productId: number): ProductProvenance {
  return {
    api_version: "2026-02-27",
    product_id: productId,
    product_name: `Product ${productId}`,
    overall_trust_score: 0.9,
    freshness_status: "fresh",
    source_count: 1,
    data_completeness_pct: 100,
    field_sources: {
      unhealthiness_score: {
        source: "Label Scan",
        last_updated: new Date().toISOString(),
        confidence: 0.9,
      },
    },
    trust_explanation: "Current score evidence",
    weakest_area: { field: null, confidence: null },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ComparisonGrid", () => {
  it("shows empty state with fewer than 2 products", () => {
    render(<ComparisonGrid products={[productA]} />);
    expect(
      screen.getByText("Select at least 2 products to compare"),
    ).toBeInTheDocument();
  });

  it("shows empty state with 0 products", () => {
    render(<ComparisonGrid products={[]} />);
    expect(
      screen.getByText("Select at least 2 products to compare"),
    ).toBeInTheDocument();
  });

  // Desktop + Mobile rendering (dual-render → getAllBy*)
  it("renders product names", () => {
    render(<ComparisonGrid products={products} />);
    // Appears in both desktop and mobile
    const nameA = screen.getAllByText("Product A");
    expect(nameA.length).toBeGreaterThanOrEqual(1);
    const nameB = screen.getAllByText("Product B");
    expect(nameB.length).toBeGreaterThanOrEqual(1);
  });

  it("renders brand names", () => {
    render(<ComparisonGrid products={products} />);
    const brands = screen.getAllByText("Brand A");
    expect(brands.length).toBeGreaterThanOrEqual(1);
  });

  it("renders TryVit scores", () => {
    render(<ComparisonGrid products={products} />);
    const scores65 = screen.getAllByText("65");
    expect(scores65.length).toBeGreaterThanOrEqual(1);
    const scores40 = screen.getAllByText("40");
    expect(scores40.length).toBeGreaterThanOrEqual(1);
  });

  it("shows winner badge for healthiest product", () => {
    render(<ComparisonGrid products={products} />);
    // Product A (35) is healthier → gets 🏆 Healthiest on desktop
    const badges = screen.getAllByText(/Healthiest/);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Metric header on desktop", () => {
    render(<ComparisonGrid products={products} />);
    expect(screen.getByText("Metric")).toBeInTheDocument();
  });

  it("renders all comparison row labels", () => {
    render(<ComparisonGrid products={products} />);
    const rowLabels = [
      "TryVit Score",
      "Nutri-Score",
      "NOVA Group",
      "Calories",
      "Total Fat",
      "Saturated Fat",
      "Sugars",
      "Salt",
      "Fibre",
      "Protein",
      "Carbs",
      "Additives",
      "Allergens",
    ];
    for (const label of rowLabels) {
      // Desktop has them all; mobile filters out nutri_score and nova_group
      const matches = screen.getAllByText(label);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("renders formatted nutrition values", () => {
    render(<ComparisonGrid products={products} />);
    // Calories for Product A = 500 kcal
    const cals = screen.getAllByText("500 kcal");
    expect(cals.length).toBeGreaterThanOrEqual(1);
  });

  it("renders allergen tags row", () => {
    render(<ComparisonGrid products={products} />);
    // Product A has "gluten, milk"
    const tags = screen.getAllByText("gluten, milk");
    expect(tags.length).toBeGreaterThanOrEqual(1);
    const unavailable = screen.getAllByText(/Evidence unavailable/);
    expect(unavailable.length).toBeGreaterThanOrEqual(1);
  });

  it("renders warnings row", () => {
    render(<ComparisonGrid products={products} />);
    // Product A has high_salt only
    const highSalt = screen.getAllByText(/High salt/);
    expect(highSalt.length).toBeGreaterThanOrEqual(1);
    // Product B has all flags
    const highSugar = screen.getAllByText(/High sugar/);
    expect(highSugar.length).toBeGreaterThanOrEqual(1);
  });

  it("shows nutri-score labels", () => {
    render(<ComparisonGrid products={products} />);
    const cLabels = screen.getAllByText("C");
    expect(cLabels.length).toBeGreaterThanOrEqual(1);
    const dLabels = screen.getAllByText("D");
    expect(dLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("shows NOVA group labels", () => {
    render(<ComparisonGrid products={products} />);
    const n3 = screen.getAllByText(/N3/);
    expect(n3.length).toBeGreaterThanOrEqual(1);
    const n4 = screen.getAllByText(/N4/);
    expect(n4.length).toBeGreaterThanOrEqual(1);
  });

  it("renders confidence badges for compared products", () => {
    render(<ComparisonGrid products={products} />);
    const verified = screen.getAllByText("Verified");
    const estimated = screen.getAllByText("Estimated");
    expect(verified.length).toBeGreaterThanOrEqual(1);
    expect(estimated.length).toBeGreaterThanOrEqual(1);
  });

  it("renders swipe hint on mobile view", () => {
    render(<ComparisonGrid products={products} />);
    expect(screen.getByText(/Swipe to compare/)).toBeInTheDocument();
  });

  it("renders dots indicator for mobile", () => {
    const { container } = render(<ComparisonGrid products={products} />);
    // dots are small spans with rounded-full class
    const dots = container.querySelectorAll(
      String.raw`.rounded-full.h-1\.5.w-1\.5`,
    );
    expect(dots.length).toBe(2); // 2 products = 2 dots
  });

  it("renders avoid badges when showAvoidBadge is true", () => {
    render(<ComparisonGrid products={products} showAvoidBadge={true} />);
    expect(
      screen.getAllByTestId("avoid-badge-1").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByTestId("avoid-badge-2").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("does not render avoid badges by default", () => {
    render(<ComparisonGrid products={products} />);
    expect(screen.queryByTestId("avoid-badge-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("avoid-badge-2")).not.toBeInTheDocument();
  });

  it("renders with three products", () => {
    const productC = makeProduct({
      product_id: 3,
      product_name: "Product C",
      brand: "Brand C",
      unhealthiness_score: 15,
      score_band: "low",
      nutri_score: "A",
    });
    render(<ComparisonGrid products={[productA, productB, productC]} />);
    const nameC = screen.getAllByText("Product C");
    expect(nameC.length).toBeGreaterThanOrEqual(1);
    // Product C (15) is healthiest
    const badges = screen.getAllByText(/Healthiest/);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Mobile-specific: winner announcement ───────────────────────────────

  it("renders winner announcement on mobile", () => {
    render(<ComparisonGrid products={products} />);
    const announcement = screen.getByTestId("winner-announcement");
    expect(announcement).toBeInTheDocument();
    // Product A (score 35) is healthier → winner
    expect(announcement).toHaveTextContent("Product A");
  });

  it("withholds winner and ranking when comparison evidence is invalid", () => {
    const incomplete = makeProduct({
      product_id: 2,
      confidence: "low",
      data_completeness_pct: 30,
      calories: null,
      allergen_tags: null,
      ingredient_count: 0,
    });
    render(<ComparisonGrid products={[productA, incomplete]} />);

    expect(screen.queryByTestId("winner-announcement")).not.toBeInTheDocument();
    expect(screen.getByTestId("comparison-ranking-withheld")).toBeInTheDocument();
    expect(
      screen.getByTestId("desktop-comparison-ranking-withheld"),
    ).toBeInTheDocument();
  });

  it("withholds nutrient rankings and no-warning claims without field-specific provenance", () => {
    const noFlagProducts = products.map((product) => ({
      ...product,
      high_salt: false,
      high_sugar: false,
      high_sat_fat: false,
      high_additive_load: false,
    }));
    render(
      <ComparisonGrid
        products={noFlagProducts}
        recommendationAllowed
        provenanceByProductId={{
          1: scoreOnlyProvenance(1),
          2: scoreOnlyProvenance(2),
        }}
      />,
    );

    expect(screen.getByTestId("winner-announcement")).toBeInTheDocument();
    expect(screen.queryByTestId("key-differences")).not.toBeInTheDocument();
    expect(screen.queryByText("No warnings")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/Warning evidence is incomplete/).length,
    ).toBeGreaterThanOrEqual(2);

    const sugarsRow = screen.getAllByText("Sugars")[0].closest("tr");
    const nutrientCells = sugarsRow?.querySelectorAll("td") ?? [];
    expect(
      [...nutrientCells].some(
        (cell) =>
          cell.className.includes("text-success-text") ||
          cell.className.includes("text-error-text"),
      ),
    ).toBe(false);
  });

  it("withholds public no-warning claims when provenance is omitted", () => {
    const noFlagProducts = products.map((product) => ({
      ...product,
      high_salt: false,
      high_sugar: false,
      high_sat_fat: false,
      high_additive_load: false,
    }));
    render(
      <ComparisonGrid
        products={noFlagProducts}
        recommendationAllowed={false}
      />,
    );

    expect(screen.queryByText("No warnings")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/Warning evidence is incomplete/).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("uses canonical NOVA provenance before ranking the NOVA row", () => {
    const provenanceByProductId = Object.fromEntries(
      products.map((product) => {
        const provenance = scoreOnlyProvenance(product.product_id);
        return [
          product.product_id,
          {
            ...provenance,
            field_sources: {
              ...provenance.field_sources,
              nova_classification: {
                source: "Label Scan",
                last_updated: new Date().toISOString(),
                confidence: 0.9,
              },
            },
          },
        ];
      }),
    );
    render(
      <ComparisonGrid
        products={products}
        recommendationAllowed
        provenanceByProductId={provenanceByProductId}
      />,
    );

    const novaRow = screen.getAllByText("NOVA Group")[0].closest("tr");
    const novaCells = novaRow?.querySelectorAll("td") ?? [];
    expect(
      [...novaCells].some(
        (cell) =>
          cell.className.includes("text-success-text") ||
          cell.className.includes("text-error-text"),
      ),
    ).toBe(true);
  });

  it("ranks evidenced values without requiring provenance for a missing value", () => {
    const productC = makeProduct({
      product_id: 3,
      product_name: "Product C",
      calories: null,
    });
    const comparisonProducts = [productA, productB, productC];
    const provenanceByProductId = Object.fromEntries(
      comparisonProducts.map((product) => {
        const provenance = scoreOnlyProvenance(product.product_id);
        return [
          product.product_id,
          {
            ...provenance,
            field_sources: {
              ...provenance.field_sources,
              ...(product.calories == null
                ? {}
                : {
                    calories_100g: {
                      source: "Label Scan",
                      last_updated: new Date().toISOString(),
                      confidence: 0.9,
                    },
                  }),
            },
          },
        ];
      }),
    );
    render(
      <ComparisonGrid
        products={comparisonProducts}
        recommendationAllowed
        provenanceByProductId={provenanceByProductId}
      />,
    );

    const caloriesRow = screen.getAllByText("Calories")[0].closest("tr");
    const caloriesCells = caloriesRow?.querySelectorAll("td") ?? [];
    expect(
      [...caloriesCells].some(
        (cell) =>
          cell.className.includes("text-success-text") ||
          cell.className.includes("text-error-text"),
      ),
    ).toBe(true);
  });

  it("shows score delta in winner announcement", () => {
    render(<ComparisonGrid products={products} />);
    const announcement = screen.getByTestId("winner-announcement");
    // TryVit scores: A=65, B=40 → delta=25
    expect(announcement).toHaveTextContent("25");
  });

  // ─── Mobile-specific: key differences ───────────────────────────────────

  it("renders key differences section on mobile", () => {
    render(<ComparisonGrid products={products} />);
    const section = screen.getByTestId("key-differences");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent("Key Differences");
  });

  it("shows nutrient values in key differences", () => {
    render(<ComparisonGrid products={products} />);
    const section = screen.getByTestId("key-differences");
    // Products differ in sugars (5 vs 20), saturated fat (10 vs 15), etc.
    // At least one row should be visible
    expect(section.querySelectorAll(".flex.items-center.justify-between").length).toBeGreaterThan(0);
  });

  // ─── Mobile-specific: collapsible sections ──────────────────────────────

  it("renders collapsible nutrition section", () => {
    render(<ComparisonGrid products={products} />);
    expect(screen.getAllByText("Full Nutrition").length).toBeGreaterThanOrEqual(1);
  });

  it("renders collapsible allergens section", () => {
    render(<ComparisonGrid products={products} />);
    const allergenSections = screen.getAllByText("Allergens");
    expect(allergenSections.length).toBeGreaterThanOrEqual(1);
  });

  it("renders collapsible warnings section", () => {
    render(<ComparisonGrid products={products} />);
    const warnSections = screen.getAllByText("Warnings");
    expect(warnSections.length).toBeGreaterThanOrEqual(1);
  });
});
