import type {
  AllergenEvidenceBasis,
  ProfileAllergenEvidence,
  ProfileAllergens,
} from "@/lib/types";

/** EU FIC Regulation 1169/2011 mandatory allergen groups. */
export const EU_14_ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soybeans",
  "milk",
  "tree-nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;

export type AllergenDisplayStatus =
  | "contains"
  | "derived"
  | "may_contain"
  | "unknown"
  | "assessed_absent";

export interface AllergenDisplayRow {
  name: string;
  status: AllergenDisplayStatus;
  evidenceBasis?: AllergenEvidenceBasis;
}

export function normaliseAllergenTag(tag: string): string {
  return tag.trim().replace(/^en:/, "").toLowerCase();
}

function parseCsvEvidence(
  csv: string,
  evidenceType: ProfileAllergenEvidence["evidence_type"],
): ProfileAllergenEvidence[] {
  return csv
    .split(",")
    .map(normaliseAllergenTag)
    .filter(Boolean)
    .map((tag) => ({
      tag,
      evidence_type: evidenceType,
      evidence_basis: "legacy_unclassified",
    }));
}

/**
 * Return positive evidence while preserving compatibility with an older API
 * payload. Legacy CSV values remain positive but are never presented as
 * explicit source declarations when provenance is unavailable.
 */
export function getAllergenEvidence(
  allergens: ProfileAllergens,
): ProfileAllergenEvidence[] {
  if (allergens.evidence) {
    return allergens.evidence.map((item) => ({
      ...item,
      tag: normaliseAllergenTag(item.tag),
    }));
  }

  return [
    ...parseCsvEvidence(allergens.contains, "contains"),
    ...parseCsvEvidence(allergens.traces, "may_contain"),
  ];
}

function containsPriority(evidence: ProfileAllergenEvidence): number {
  if (evidence.evidence_basis === "explicit_source") return 0;
  if (evidence.evidence_basis === "ingredient_derived") return 1;
  return 2;
}

export function buildAllergenDisplayRows(
  allergens: ProfileAllergens,
): AllergenDisplayRow[] {
  const evidence = getAllergenEvidence(allergens);
  const evidenceByTag = new Map<string, ProfileAllergenEvidence[]>();

  for (const item of evidence) {
    const entries = evidenceByTag.get(item.tag) ?? [];
    entries.push(item);
    evidenceByTag.set(item.tag, entries);
  }

  const assessedAbsent = new Set(
    allergens.absence_assessment === "assessed"
      ? (allergens.assessed_absent ?? []).map(normaliseAllergenTag)
      : [],
  );
  const allNames = new Set<string>([
    ...EU_14_ALLERGENS,
    ...evidenceByTag.keys(),
    ...assessedAbsent,
  ]);

  const rows: AllergenDisplayRow[] = [];
  for (const name of allNames) {
    const entries = evidenceByTag.get(name) ?? [];
    const contains = entries
      .filter((item) => item.evidence_type === "contains")
      .toSorted((a, b) => containsPriority(a) - containsPriority(b));
    const mayContain = entries.find(
      (item) => item.evidence_type === "may_contain",
    );

    if (contains.length > 0) {
      const strongest = contains[0];
      rows.push({
        name,
        status:
          strongest.evidence_basis === "ingredient_derived"
            ? "derived"
            : "contains",
        evidenceBasis: strongest.evidence_basis,
      });
    } else if (mayContain) {
      rows.push({
        name,
        status: "may_contain",
        evidenceBasis: mayContain.evidence_basis,
      });
    } else if (assessedAbsent.has(name)) {
      rows.push({ name, status: "assessed_absent" });
    } else {
      rows.push({ name, status: "unknown" });
    }
  }

  const statusOrder: Record<AllergenDisplayStatus, number> = {
    contains: 0,
    derived: 1,
    may_contain: 2,
    unknown: 3,
    assessed_absent: 4,
  };

  return rows.toSorted(
    (a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name),
  );
}
