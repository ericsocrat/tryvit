import { NUTRIENT_KEYS, ProductReadModelSchema, type NutrientObservation, type ProductReadEnvelope, type ProductReadModel } from "@/lib/evidence/product-read-model";

/** Synthetic component-test facts only; never an ingestion or production fixture. */
export function evidenceProduct(id = 1, fieldOverrides: Partial<NutrientObservation> = {}): ProductReadModel {
  const observationId = `11111111-1111-4111-8111-${String(id).padStart(12, "0")}`;
  return ProductReadModelSchema.parse({
    product_id: id, product_name: `Fixture product ${id}`, product_name_original: `Fixture product ${id}`,
    brand: "Fixture brand", country: "PL", category: "Dairy", ean: null, is_deprecated: false, image: null,
    nutrition: Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, {
      value: "0.001", unit: key === "calories" ? "kcal" : "g", basis: "per_100g", preparation_state: "as_sold", state: "recorded", qualifier: "eq", observation_id: observationId, ...fieldOverrides,
    }])),
    ingredients: { state: "missing", items: [] }, allergens: { state: "missing", contains: [], traces: [] },
    suitability: { vegan: "unknown", vegetarian: "unknown" },
    classifications: { nutri_score: { value: "A", source: "fixture-source", version: "2023", observation_id: observationId }, nova: { value: "2", source: "fixture-source", observation_id: observationId } },
    sources: [{ observation_id: observationId, source_key: "fixture-source", source_url: "https://example.org/fixture-product", license: "Fixture only", retrieved_at: "2026-09-04T00:00:00.000Z", source_updated_at: "2026-08-01T00:00:00.000Z" }],
    evidence: { state: "recorded", recorded_fields: !fieldOverrides.state || fieldOverrides.state === "recorded" ? 9 : 0, total_fields: 9, reasons: [] },
    score: { status: "retired", value: null, model_version: "legacy", reason: "unsupported_aggregate" },
  });
}

export function legacyProduct(id = 1): ProductReadModel {
  const product = evidenceProduct(id, { state: "unverified", basis: "unknown", preparation_state: "unknown", observation_id: null, qualifier: null });
  return { ...product, sources: [],
    classifications: { nutri_score: { value: null, source: null, version: null, observation_id: null }, nova: { value: null, source: null, observation_id: null } },
    evidence: { state: "legacy_unverified", recorded_fields: 0, total_fields: 9, reasons: ["source_not_collected"] } };
}

export function evidenceEnvelope(products: ProductReadModel[], missing_ids: number[] = []): ProductReadEnvelope {
  return { api_version: "2", policy_version: "evidence-first-v1", products, missing_ids };
}
