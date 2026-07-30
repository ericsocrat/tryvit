import type { ProfileAllergens } from "@/lib/types";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { AllergenMatrix } from "./AllergenMatrix";

function makeAllergens(
  overrides: Partial<ProfileAllergens> = {},
): ProfileAllergens {
  return {
    contains: "gluten,milk",
    traces: "eggs,soybeans",
    contains_count: 2,
    traces_count: 2,
    evidence: [
      {
        tag: "gluten",
        evidence_type: "contains",
        evidence_basis: "ingredient_derived",
      },
      {
        tag: "milk",
        evidence_type: "contains",
        evidence_basis: "explicit_source",
      },
      {
        tag: "eggs",
        evidence_type: "may_contain",
        evidence_basis: "explicit_source",
      },
      {
        tag: "soybeans",
        evidence_type: "may_contain",
        evidence_basis: "legacy_unclassified",
      },
    ],
    evidence_status: "positive_evidence_available",
    absence_assessment: "not_assessed",
    assessed_absent: [],
    ...overrides,
  };
}

describe("AllergenMatrix", () => {
  it("renders a neutral unavailable state and unknown EU-14 rows with no evidence", () => {
    render(
      <AllergenMatrix
        allergens={makeAllergens({
          contains: "",
          traces: "",
          contains_count: 0,
          traces_count: 0,
          evidence: [],
          evidence_status: "unknown",
        })}
      />,
    );
    expect(
      screen.getByText("product.allergenEvidenceUnavailable"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(14);
    expect(screen.getAllByText("allergenMatrix.unknown")).toHaveLength(15);
  });

  it("does not render success styling when evidence is missing", () => {
    render(
      <AllergenMatrix
        allergens={makeAllergens({
          contains: "",
          traces: "",
          contains_count: 0,
          traces_count: 0,
          evidence: [],
        })}
      />,
    );
    const table = screen.getByRole("table");
    expect(table.querySelector(".bg-success-bg")).toBeNull();
    expect(table.querySelector(".text-success-text")).toBeNull();
  });

  it("distinguishes explicit, derived, may-contain, and unknown states", () => {
    render(<AllergenMatrix allergens={makeAllergens()} />);
    const rows = screen.getAllByRole("row");
    const rowFor = (name: string) =>
      rows.find((row) => row.textContent?.includes(`allergens.${name}`));

    expect(rowFor("milk")?.textContent).toContain("allergenMatrix.contains");
    expect(rowFor("gluten")?.textContent).toContain("allergenMatrix.derived");
    expect(rowFor("eggs")?.textContent).toContain("allergenMatrix.traces");
    expect(rowFor("peanuts")?.textContent).toContain("allergenMatrix.unknown");
  });

  it("marks positive legacy evidence with unavailable provenance", () => {
    render(<AllergenMatrix allergens={makeAllergens()} />);
    expect(
      screen.getByText("allergenMatrix.provenanceUnavailable"),
    ).toBeInTheDocument();
  });

  it("preserves the legacy CSV response shape without calling gaps free", () => {
    render(
      <AllergenMatrix
        allergens={{
          contains: "en:milk",
          traces: "gluten",
          contains_count: 1,
          traces_count: 1,
        }}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("allergens.milk")).toBeInTheDocument();
    expect(within(table).getByText("allergens.gluten")).toBeInTheDocument();
    expect(screen.queryByText("allergenMatrix.free")).not.toBeInTheDocument();
  });

  it("supports authoritative assessed absence without inferring it", () => {
    render(
      <AllergenMatrix
        allergens={makeAllergens({
          evidence: [],
          contains: "",
          traces: "",
          contains_count: 0,
          traces_count: 0,
          absence_assessment: "assessed",
          assessed_absent: ["milk"],
        })}
      />,
    );
    const milkRow = screen
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("allergens.milk"));
    expect(milkRow?.textContent).toContain("allergenMatrix.assessedAbsent");
  });
});
