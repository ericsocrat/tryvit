export type EvidenceOrigin = "observed" | "derived" | "contextual" | "decision";
export type EvidenceAvailability =
  | "available"
  | "partial"
  | "unknown"
  | "stale"
  | "unavailable";

export interface GoldenEvidenceItem {
  readonly id: string;
  readonly origin: EvidenceOrigin;
  readonly availability: EvidenceAvailability;
  readonly label: string;
  readonly value: string;
  readonly source: string;
  readonly recovery?: string;
}

export interface GoldenProductFixture {
  readonly id: string;
  readonly ean: string;
  readonly name: string;
  readonly brand: string;
  readonly sourceLabel: string;
  readonly observedOn: string;
  readonly decisionScore: number | null;
  readonly dataConfidence: "moderate" | "limited" | "unavailable";
  readonly confidenceReason: string;
  readonly mainReason: string;
  readonly availability: EvidenceAvailability;
}

export const GOLDEN_PRIMARY_PRODUCT = Object.freeze({
  id: "north-grain-oat-drink",
  ean: "5901234123457",
  name: "North Grain Oat Drink — review fixture",
  brand: "North Grain",
  sourceLabel: "One synthetic package transcription",
  observedOn: "2026-07-14T12:00:00.000Z",
  decisionScore: 72,
  dataConfidence: "moderate",
  confidenceReason: "One package transcription; zero independent checks.",
  mainReason: "Sugars are available, while processing classification is not assessed.",
  availability: "partial",
  nutritionPer100ml: Object.freeze({
    energyKj: 193,
    energyKcal: 46,
    fatG: 1.5,
    saturatesG: 0.2,
    carbohydratesG: 7.4,
    sugarsG: 3.2,
    fibreG: 0.8,
    proteinG: 1,
    saltG: 0.1,
  }),
  ingredients: Object.freeze([
    "water",
    "oats 11%",
    "rapeseed oil",
    "calcium carbonate",
    "salt",
  ]),
  evidence: Object.freeze([
    {
      id: "observed-sugars",
      origin: "observed",
      availability: "available",
      label: "Sugars per 100 ml",
      value: "3.2 g",
      source: "Package nutrition table · observed 14 July 2026",
    },
    {
      id: "derived-score",
      origin: "derived",
      availability: "partial",
      label: "Concept decision score",
      value: "72 / 100",
      source: "TryVit review method v0.9 · incomplete inputs",
      recovery: "Inspect the missing processing input before relying on the score.",
    },
    {
      id: "context-serving",
      origin: "contextual",
      availability: "available",
      label: "Comparison basis",
      value: "Per 100 ml",
      source: "Like-for-like oat-drink category fixture",
    },
    {
      id: "decision-next",
      origin: "decision",
      availability: "partial",
      label: "Next action",
      value: "Check the package and inspect missing evidence",
      source: "Review-only decision summary",
      recovery: "Compare only records using the same method and serving basis.",
    },
  ] satisfies readonly GoldenEvidenceItem[]),
  allergens: Object.freeze({
    contains: Object.freeze([
      {
        name: "Oats",
        basis: "ingredient-derived",
        source: "Ingredient list",
      },
    ]),
    mayContain: Object.freeze([
      {
        name: "Soy",
        basis: "explicit-source",
        source: "Package precautionary statement",
      },
    ]),
    unknown: Object.freeze([
      "All other allergen absence has not been assessed.",
    ]),
  }),
  flags: Object.freeze({
    synthetic: true,
    reviewOnly: true,
    noExternalLookup: true,
    notMedicalAdvice: true,
  }),
});

export const GOLDEN_SEARCH_PRODUCTS = Object.freeze([
  GOLDEN_PRIMARY_PRODUCT,
  {
    id: "polny-owies",
    ean: "5901234123464",
    name: "Napój owsiany Polny Owies — materiał syntetyczny",
    brand: "Polny Owies",
    sourceLabel: "Syntetyczny rekord opakowania",
    observedOn: "2026-07-13T12:00:00.000Z",
    decisionScore: 66,
    dataConfidence: "limited",
    confidenceReason: "Nutrition table available; ingredient percentages are incomplete.",
    mainReason: "Comparable nutrition is available, but ingredient detail is partial.",
    availability: "partial",
  },
  {
    id: "lange-haferquelle",
    ean: "5901234123471",
    name: "Haferquelle Original ohne bestätigte Verarbeitungsklassifikation — Prüfmuster",
    brand: "Haferquelle",
    sourceLabel: "Synthetischer Verpackungsdatensatz",
    observedOn: "2026-07-11T12:00:00.000Z",
    decisionScore: null,
    dataConfidence: "unavailable",
    confidenceReason: "A required score input is unavailable.",
    mainReason: "No score is shown because the record cannot be compared safely.",
    availability: "unknown",
  },
] as const satisfies readonly GoldenProductFixture[]);

export const GOLDEN_FIXTURE_CONTRACT_VERSION = "phase5a2-golden-fixture-v1";
