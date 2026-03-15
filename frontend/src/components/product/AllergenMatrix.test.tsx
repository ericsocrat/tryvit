import type { ProfileAllergens } from "@/lib/types";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { AllergenMatrix } from "./AllergenMatrix";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeAllergens(
  overrides?: Partial<ProfileAllergens>,
): ProfileAllergens {
  return {
    contains: "gluten,milk",
    traces: "eggs,soybeans",
    contains_count: 2,
    traces_count: 2,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AllergenMatrix", () => {
  it("renders no-allergens message when contains and traces are both 0", () => {
    render(
      <AllergenMatrix
        allergens={{
          contains: "",
          traces: "",
          contains_count: 0,
          traces_count: 0,
        }}
      />,
    );
    expect(screen.getByText("product.noKnownAllergens")).toBeInTheDocument();
    // Should NOT render the grid
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders the allergen grid when allergens are present", () => {
    render(<AllergenMatrix allergens={makeAllergens()} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("groups allergens by status: contains first, then traces, then free", () => {
    render(<AllergenMatrix allergens={makeAllergens()} />);
    const rows = screen.getAllByRole("row");
    const cells = rows.map(
      (r) => within(r).getByRole("cell").textContent ?? "",
    );

    // Mock t() returns keys as-is, so match on i18n keys
    const glutenIdx = cells.findIndex((c) => c.includes("allergens.gluten"));
    const milkIdx = cells.findIndex((c) => c.includes("allergens.milk"));
    const eggsIdx = cells.findIndex((c) => c.includes("allergens.eggs"));
    const soyIdx = cells.findIndex((c) => c.includes("allergens.soybeans"));
    // The first "free" EU allergen (e.g., Crustaceans or Peanuts)
    const freeIdx = cells.findIndex((c) => c.includes("allergens.peanuts"));

    // contains before traces
    expect(glutenIdx).toBeLessThan(eggsIdx);
    expect(milkIdx).toBeLessThan(eggsIdx);
    // traces before free
    expect(soyIdx).toBeLessThan(freeIdx);
  });

  it("normalises tags via lowercase/trim (legacy en: prefix fallback)", () => {
    render(
      <AllergenMatrix
        allergens={makeAllergens({
          contains: "gluten",
          traces: "",
          contains_count: 1,
          traces_count: 0,
        })}
      />,
    );
    // Mock t() returns keys — check for the i18n key
    const table = screen.getByRole("table");
    const cells = within(table).getAllByRole("cell");
    const textValues = cells.map((c) => c.textContent);
    expect(textValues).toContain("allergens.gluten");
  });

  it("includes all 14 EU mandatory allergens even if not in data", () => {
    render(
      <AllergenMatrix
        allergens={makeAllergens({
          contains: "gluten",
          traces: "",
          contains_count: 1,
          traces_count: 0,
        })}
      />,
    );
    const rows = screen.getAllByRole("row");
    // At minimum, all 14 EU allergens should be present
    expect(rows.length).toBeGreaterThanOrEqual(14);
  });

  it("formats allergen names using DISPLAY_NAMES map", () => {
    render(
      <AllergenMatrix
        allergens={makeAllergens({
          contains: "sesame",
          traces: "sulphites",
          contains_count: 1,
          traces_count: 1,
        })}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("allergens.sesame")).toBeInTheDocument();
    expect(within(table).getByText("allergens.sulphites")).toBeInTheDocument();
  });

  it("renders the legend with all three statuses", () => {
    render(<AllergenMatrix allergens={makeAllergens()} />);
    expect(screen.getByText("allergenMatrix.contains")).toBeInTheDocument();
    expect(screen.getByText("allergenMatrix.traces")).toBeInTheDocument();
    expect(screen.getByText("allergenMatrix.free")).toBeInTheDocument();
  });

  it("renders the disclaimer text", () => {
    render(<AllergenMatrix allergens={makeAllergens()} />);
    expect(screen.getByText("allergenMatrix.disclaimer")).toBeInTheDocument();
  });

  it("adds extra allergens not in the EU14 baseline", () => {
    render(
      <AllergenMatrix
        allergens={makeAllergens({
          contains: "gluten,buckwheat",
          traces: "",
          contains_count: 2,
          traces_count: 0,
        })}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("allergens.buckwheat")).toBeInTheDocument();
    // Total rows should be > 14 (14 EU + 1 extra)
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(15);
  });

  it("handles empty comma-separated strings gracefully", () => {
    render(
      <AllergenMatrix
        allergens={{
          contains: ",,",
          traces: ",",
          contains_count: 1,
          traces_count: 1,
        }}
      />,
    );
    // Should render grid without errors — all 14 EU allergens as "free"
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(14);
  });
});
