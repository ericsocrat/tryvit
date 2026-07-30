import type { ProfileAllergens } from "@/lib/types";
import { describe, expect, it } from "vitest";
import {
  buildAllergenDisplayRows,
  getAllergenEvidence,
} from "./allergen-evidence";

function profile(overrides: Partial<ProfileAllergens> = {}): ProfileAllergens {
  return {
    contains: "",
    traces: "",
    contains_count: 0,
    traces_count: 0,
    evidence: [],
    evidence_status: "unknown",
    absence_assessment: "not_assessed",
    assessed_absent: [],
    ...overrides,
  };
}

describe("allergen evidence semantics", () => {
  it("preserves explicit contains evidence", () => {
    const rows = buildAllergenDisplayRows(
      profile({
        evidence: [
          {
            tag: "milk",
            evidence_type: "contains",
            evidence_basis: "explicit_source",
          },
        ],
      }),
    );
    expect(rows.find((row) => row.name === "milk")).toMatchObject({
      status: "contains",
      evidenceBasis: "explicit_source",
    });
  });

  it("preserves explicit may-contain evidence", () => {
    const rows = buildAllergenDisplayRows(
      profile({
        evidence: [
          {
            tag: "eggs",
            evidence_type: "may_contain",
            evidence_basis: "explicit_source",
          },
        ],
      }),
    );
    expect(rows.find((row) => row.name === "eggs")?.status).toBe(
      "may_contain",
    );
  });

  it("keeps deterministic ingredient-derived evidence distinguishable", () => {
    const rows = buildAllergenDisplayRows(
      profile({
        evidence: [
          {
            tag: "gluten",
            evidence_type: "contains",
            evidence_basis: "ingredient_derived",
          },
        ],
      }),
    );
    expect(rows.find((row) => row.name === "gluten")?.status).toBe("derived");
  });

  it("treats no evidence and every unmentioned EU-14 allergen as unknown", () => {
    const rows = buildAllergenDisplayRows(profile());
    expect(rows).toHaveLength(14);
    expect(rows.every((row) => row.status === "unknown")).toBe(true);
  });

  it("handles mixed explicit and derived evidence without inferring absence", () => {
    const rows = buildAllergenDisplayRows(
      profile({
        evidence: [
          {
            tag: "milk",
            evidence_type: "contains",
            evidence_basis: "explicit_source",
          },
          {
            tag: "gluten",
            evidence_type: "contains",
            evidence_basis: "ingredient_derived",
          },
        ],
      }),
    );
    expect(rows.find((row) => row.name === "milk")?.status).toBe("contains");
    expect(rows.find((row) => row.name === "gluten")?.status).toBe("derived");
    expect(rows.find((row) => row.name === "eggs")?.status).toBe("unknown");
  });

  it("only presents assessed absence when the contract says assessment occurred", () => {
    const unassessed = buildAllergenDisplayRows(
      profile({ assessed_absent: ["milk"] }),
    );
    expect(unassessed.find((row) => row.name === "milk")?.status).toBe(
      "unknown",
    );

    const assessed = buildAllergenDisplayRows(
      profile({
        absence_assessment: "assessed",
        assessed_absent: ["milk"],
      }),
    );
    expect(assessed.find((row) => row.name === "milk")?.status).toBe(
      "assessed_absent",
    );
  });

  it("keeps older CSV-only responses positive but provenance-unclassified", () => {
    const evidence = getAllergenEvidence({
      contains: "en:milk",
      traces: "gluten",
      contains_count: 1,
      traces_count: 1,
    });
    expect(evidence).toEqual([
      {
        tag: "milk",
        evidence_type: "contains",
        evidence_basis: "legacy_unclassified",
      },
      {
        tag: "gluten",
        evidence_type: "may_contain",
        evidence_basis: "legacy_unclassified",
      },
    ]);
  });
});
