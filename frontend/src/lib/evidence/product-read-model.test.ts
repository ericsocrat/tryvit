import { describe, expect, it } from "vitest";
import { compareNutrientObservations, NutrientObservationSchema, ProductReadModelSchema, type NutrientObservation } from "./product-read-model";
import { evidenceProduct, legacyProduct } from "@/components/evidence/product-evidence.fixtures";

const sample = (overrides: Partial<NutrientObservation> = {}): NutrientObservation => ({
  value: "0.001", unit: "g", basis: "per_100g", preparation_state: "as_sold", state: "recorded", qualifier: "eq", observation_id: "11111111-1111-4111-8111-111111111111", ...overrides,
});

describe("product evidence consistency", () => {
  it("binds each classification to an exact revision, not merely a provider name", () => {
    const product = evidenceProduct();
    const newerId = "22222222-2222-4222-8222-222222222222";
    product.sources.push({ ...product.sources[0], observation_id: newerId, retrieved_at: "2026-09-05T00:00:00Z" });
    product.classifications.nutri_score.observation_id = newerId;
    expect(ProductReadModelSchema.safeParse(product).success).toBe(true);
    product.sources.pop();
    expect(ProductReadModelSchema.safeParse(product).success).toBe(false);
    product.classifications.nutri_score.observation_id = null;
    expect(ProductReadModelSchema.safeParse(product).success).toBe(false);
    product.classifications.nutri_score.observation_id = product.sources[0].observation_id;
    product.classifications.nova.observation_id = newerId;
    expect(ProductReadModelSchema.safeParse(product).success).toBe(false);
  });

  it("requires recorded image lineage and keeps legacy image dates unknown", () => {
    const product = evidenceProduct();
    product.image = { url: "https://images.openfoodfacts.org/fixture.jpg", source: "OFF", alt: "Fixture", state: "recorded", observation_id: product.sources[0].observation_id, source_key: product.sources[0].source_key };
    expect(ProductReadModelSchema.safeParse(product).success).toBe(true);
    product.image.source_key = "another-source";
    expect(ProductReadModelSchema.safeParse(product).success).toBe(false);
    product.image.state = "unverified";
    expect(ProductReadModelSchema.safeParse(product).success).toBe(false);
    product.image.source_key = null;
    product.image.observation_id = null;
    expect(ProductReadModelSchema.safeParse(product).success).toBe(true);
    product.image.state = "recorded";
    expect(ProductReadModelSchema.safeParse(product).success).toBe(false);
  });

  it("rejects exaggerated completeness, duplicate sources and invented classifications", () => {
    const product = evidenceProduct();
    expect(ProductReadModelSchema.safeParse({ ...product, evidence: { ...product.evidence, recorded_fields: 8 } }).success).toBe(false);
    expect(ProductReadModelSchema.safeParse({ ...product, sources: [...product.sources, ...product.sources] }).success).toBe(false);
    expect(ProductReadModelSchema.safeParse({ ...product, classifications: { ...product.classifications, nova: { value: "5", source: "fixture-source" } } }).success).toBe(false);
    expect(ProductReadModelSchema.safeParse({ ...product, classifications: { ...product.classifications, nova: { value: "4", source: "invented" } } }).success).toBe(false);
  });
  it("does not call a retained source legacy-only just because every nutrient is missing", () => {
    const product = evidenceProduct(1, { value: null, state: "missing", qualifier: null });
    expect(ProductReadModelSchema.parse(product).evidence).toMatchObject({ state: "recorded", recorded_fields: 0 });
    expect(ProductReadModelSchema.safeParse({ ...product, evidence: { ...product.evidence, state: "legacy_unverified" } }).success).toBe(false);
    expect(ProductReadModelSchema.safeParse(legacyProduct()).success).toBe(true);
  });
});

describe("source-backed nutrient observations", () => {
  it("preserves explicit zero and sub-gram source precision", () => {
    expect(NutrientObservationSchema.parse(sample({ value: "0" })).value).toBe("0");
    expect(NutrientObservationSchema.parse(sample()).value).toBe("0.001");
  });
  it.each(["NaN", "Infinity", "-1", "1e-3", "0,1", "<0.1"])("rejects unnormalized numeric value %s", (value) => {
    expect(NutrientObservationSchema.safeParse(sample({ value })).success).toBe(false);
  });
  it("requires provenance for a recorded field", () => {
    expect(NutrientObservationSchema.safeParse(sample({ observation_id: null })).success).toBe(false);
    expect(NutrientObservationSchema.safeParse(sample({ value: null })).success).toBe(false);
  });
  it.each(["missing", "invalid", "conflicting"] as const)("never publishes a selected numeric value for %s", (state) => {
    expect(NutrientObservationSchema.safeParse(sample({ state })).success).toBe(false);
    expect(NutrientObservationSchema.safeParse(sample({ state, value: null })).success).toBe(true);
  });
  it("retains inequality as a qualifier, not an assumed exact value", () => {
    expect(NutrientObservationSchema.parse(sample({ value: "0.1", qualifier: "lt" })).qualifier).toBe("lt");
    expect(compareNutrientObservations(sample({ qualifier: "lt" }), sample()).comparable).toBe(false);
    expect(compareNutrientObservations(sample({ qualifier: "approx" }), sample()).comparable).toBe(false);
  });
});

describe("compatible factual comparison", () => {
  it("compares decimals exactly without floating-point rounding", () => {
    expect(compareNutrientObservations(sample({ value: "0.100000000001" }), sample({ value: "0.1" }))).toEqual({ comparable: true, relation: "higher" });
    expect(compareNutrientObservations(sample({ value: "0.10" }), sample({ value: "0.1" }))).toEqual({ comparable: true, relation: "equal" });
    expect(compareNutrientObservations(sample({ value: "0" }), sample())).toEqual({ comparable: true, relation: "lower" });
  });
  it.each(["unverified", "missing", "invalid", "conflicting"] as const)("withholds arithmetic for %s evidence", (state) => {
    expect(compareNutrientObservations(sample({ state }), sample())).toEqual({ comparable: false, reason: "evidence_unavailable" });
  });
  it.each([
    { basis: "per_100ml" }, { basis: "unknown" }, { basis: "per_serving" }, { unit: "kcal" }, { preparation_state: "prepared" }, { preparation_state: "unknown" },
  ] as Partial<NutrientObservation>[])("does not infer a conversion for %j", (change) => {
    expect(compareNutrientObservations(sample(change), sample())).toEqual({ comparable: false, reason: "incompatible_basis" });
  });
});
