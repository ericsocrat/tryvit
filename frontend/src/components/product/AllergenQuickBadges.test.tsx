import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProfileAllergens } from "@/lib/types";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { AllergenQuickBadges } from "./AllergenQuickBadges";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeAllergens(
  overrides?: Partial<ProfileAllergens>,
): ProfileAllergens {
  return {
    contains: "gluten,milk",
    traces: "eggs,soybeans",
    contains_count: 2,
    traces_count: 2,
    evidence: [
      { tag: "gluten", evidence_type: "contains", evidence_basis: "ingredient_derived" },
      { tag: "milk", evidence_type: "contains", evidence_basis: "explicit_source" },
      { tag: "eggs", evidence_type: "may_contain", evidence_basis: "explicit_source" },
      { tag: "soybeans", evidence_type: "may_contain", evidence_basis: "legacy_unclassified" },
    ],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AllergenQuickBadges", () => {
  // ── With allergens ───────────────────────────────────────────────────────

  it("renders contains allergens as badges", () => {
    render(<AllergenQuickBadges allergens={makeAllergens()} />);
    expect(screen.getByText("gluten")).toBeInTheDocument();
    expect(screen.getByText("milk")).toBeInTheDocument();
  });

  it("renders traces allergens as badges", () => {
    render(<AllergenQuickBadges allergens={makeAllergens()} />);
    expect(screen.getByText("eggs")).toBeInTheDocument();
    expect(screen.getByText("soybeans")).toBeInTheDocument();
  });

  it("renders allergen matrix title", () => {
    render(<AllergenQuickBadges allergens={makeAllergens()} />);
    expect(screen.getByText("allergenMatrix.title")).toBeInTheDocument();
  });

  // ── Contains only ────────────────────────────────────────────────────────

  it("renders only contains when traces is empty", () => {
    render(
      <AllergenQuickBadges
        allergens={makeAllergens({
          traces: "",
          traces_count: 0,
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
          ],
        })}
      />,
    );
    expect(screen.getByText("gluten")).toBeInTheDocument();
    expect(screen.getByText("milk")).toBeInTheDocument();
    expect(screen.queryByText("eggs")).not.toBeInTheDocument();
  });

  // ── Traces only ──────────────────────────────────────────────────────────

  it("renders only traces when contains is empty", () => {
    render(
      <AllergenQuickBadges
        allergens={makeAllergens({
          contains: "",
          contains_count: 0,
          evidence: [
            { tag: "eggs", evidence_type: "may_contain", evidence_basis: "explicit_source" },
            { tag: "soybeans", evidence_type: "may_contain", evidence_basis: "legacy_unclassified" },
          ],
        })}
      />,
    );
    expect(screen.getByText("eggs")).toBeInTheDocument();
    expect(screen.queryByText("gluten")).not.toBeInTheDocument();
  });

  // ── Empty state ──────────────────────────────────────────────────────────

  it("renders neutral unavailable evidence when both are empty", () => {
    render(
      <AllergenQuickBadges
        allergens={{
          contains: "",
          traces: "",
          contains_count: 0,
          traces_count: 0,
          evidence: [],
        }}
      />,
    );
    expect(
      screen.getByText("product.allergenEvidenceUnavailable"),
    ).toBeInTheDocument();
  });

  it("does not render title in empty state", () => {
    render(
      <AllergenQuickBadges
        allergens={{
          contains: "",
          traces: "",
          contains_count: 0,
          traces_count: 0,
          evidence: [],
        }}
      />,
    );
    expect(
      screen.queryByText("allergenMatrix.title"),
    ).not.toBeInTheDocument();
  });
});
