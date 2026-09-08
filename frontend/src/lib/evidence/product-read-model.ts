import * as z from "zod/mini";
import { EvidenceInteger } from "./integer";

/** Facts and their lineage, not a health ranking or probability of correctness. */
import { EVIDENCE_POLICY_VERSION } from "./policy";
export { EVIDENCE_POLICY_VERSION } from "./policy";
export const NUTRIENT_KEYS = [
  "calories", "total_fat_g", "saturated_fat_g", "trans_fat_g", "carbs_g",
  "sugars_g", "fibre_g", "protein_g", "salt_g",
] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

const State = z.enum(["recorded", "unverified", "missing", "invalid", "conflicting"]);
const Decimal = z.string().check(z.maxLength(256)).check(z.regex(/^\d+(?:\.\d+)?$/));
const SourceId = z.uuid();
const SourceUrl = z.url().check(z.refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Evidence URLs must be credential-free HTTPS"));

export const NutrientObservationSchema = z.object({
  value: z.nullable(Decimal),
  unit: z.enum(["g", "kcal", "kJ"]),
  basis: z.enum(["per_100g", "per_100ml", "per_serving", "unknown"]),
  preparation_state: z.enum(["as_sold", "prepared", "unknown"]),
  state: State,
  qualifier: z.nullable(z.enum(["eq", "lt", "lte", "gt", "gte", "approx"])),
  observation_id: z.nullable(SourceId),
}).check(z.superRefine((field, ctx) => {
  if (field.state === "recorded" && (field.value === null || field.observation_id === null)) {
    ctx.addIssue({ code: "custom", message: "Recorded nutrition requires a value and source observation" });
  }
  if (["missing", "invalid", "conflicting"].includes(field.state) && field.value !== null) {
    ctx.addIssue({ code: "custom", message: "Unresolved nutrition cannot publish a selected value" });
  }
}));
export type NutrientObservation = z.infer<typeof NutrientObservationSchema>;

const AssertionSchema = z.object({
  name: z.string().check(z.minLength(1)),
  state: z.enum(["recorded", "unverified"]),
  observation_id: z.nullable(SourceId),
}).check(z.refine((item) => item.state !== "recorded" || item.observation_id !== null, "Recorded assertions require a source observation"));

export const ProductReadModelSchema = z.object({
  product_id: EvidenceInteger.check(z.positive()),
  product_name: z.string().check(z.minLength(1)),
  product_name_original: z.string().check(z.minLength(1)),
  brand: z.string(),
  country: z.string().check(z.length(2)),
  category: z.string(),
  ean: z.nullable(z.string()),
  is_deprecated: z.boolean(),
  image: z.nullable(z.object({ url: SourceUrl, source: z.string(), alt: z.string(), state: z.enum(["recorded", "unverified"]), observation_id: z.nullable(SourceId), source_key: z.nullable(z.string()) })),
  nutrition: z.object(Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, NutrientObservationSchema])) as Record<NutrientKey, typeof NutrientObservationSchema>),
  ingredients: z.object({ state: State, items: z.array(AssertionSchema) }),
  allergens: z.object({ state: State, contains: z.array(AssertionSchema), traces: z.array(AssertionSchema) }),
  suitability: z.object({ vegan: z.enum(["no", "unknown"]), vegetarian: z.enum(["no", "unknown"]) }),
  classifications: z.object({
    nutri_score: z.object({ value: z.nullable(z.enum(["A", "B", "C", "D", "E"])), source: z.nullable(z.string()), version: z.nullable(z.string()), observation_id: z.nullable(SourceId) }),
    nova: z.object({ value: z.nullable(z.enum(["1", "2", "3", "4"])), source: z.nullable(z.string()), observation_id: z.nullable(SourceId) }),
  }),
  sources: z.array(z.object({
    observation_id: SourceId,
    source_key: z.string(),
    source_url: SourceUrl,
    license: z.string(),
    retrieved_at: z.iso.datetime({ offset: true }),
    source_updated_at: z.nullable(z.iso.datetime({ offset: true })),
  })),
  evidence: z.object({
    state: z.enum(["recorded", "legacy_unverified", "conflicting"]),
    recorded_fields: EvidenceInteger.check(z.minimum(0)).check(z.maximum(9)),
    total_fields: z.literal(9),
    reasons: z.array(z.string()),
  }),
  score: z.object({
    status: z.literal("retired"),
    value: z.null(),
    model_version: z.nullable(z.string()),
    reason: z.literal("unsupported_aggregate"),
  }),
}).check(z.superRefine((product, ctx) => {
  const sources = new Set(product.sources.map((source) => source.observation_id));
  if (sources.size !== product.sources.length) {
    ctx.addIssue({ code: "custom", message: "Source observations must be unique" });
  }
  const recorded = Object.values(product.nutrition).filter((field) => field.state === "recorded").length;
  if (product.evidence.recorded_fields !== recorded) {
    ctx.addIssue({ code: "custom", message: "Completeness must match the actual recorded fields" });
  }
  if ((product.evidence.state === "recorded" && sources.size === 0) ||
      (product.evidence.state === "legacy_unverified" && sources.size > 0)) {
    ctx.addIssue({ code: "custom", message: "Evidence summary must match the available source observations" });
  }
  for (const classification of Object.values(product.classifications)) {
    if (classification.value !== null && (!classification.observation_id || !classification.source || !product.sources.some((source) => source.observation_id === classification.observation_id && source.source_key === classification.source))) {
      ctx.addIssue({ code: "custom", message: "A classification must resolve to its exact attributed observation" });
    }
    if (classification.value === null && (classification.observation_id !== null || classification.source !== null)) {
      ctx.addIssue({ code: "custom", message: "An absent classification cannot claim an observation" });
    }
  }
  if (product.image?.state === "recorded" && (!product.image.observation_id || !product.sources.some((source) => source.observation_id === product.image?.observation_id && source.source_key === product.image?.source_key))) {
    ctx.addIssue({ code: "custom", message: "A recorded image must resolve to its exact attributed observation" });
  }
  if (product.image?.state === "unverified" && (product.image.observation_id !== null || product.image.source_key !== null)) {
    ctx.addIssue({ code: "custom", message: "An unverified legacy image cannot claim source observation dates" });
  }
  for (const field of [...Object.values(product.nutrition), ...product.ingredients.items, ...product.allergens.contains, ...product.allergens.traces]) {
    if (field.observation_id && !sources.has(field.observation_id)) {
      ctx.addIssue({ code: "custom", message: "Observation does not resolve to an exposed product source" });
    }
  }
  for (const source of product.sources) {
    if (source.source_updated_at && Date.parse(source.source_updated_at) > Date.parse(source.retrieved_at)) {
      ctx.addIssue({ code: "custom", message: "Source update cannot follow its retrieval" });
    }
  }
}));

export const ProductReadEnvelopeSchema = z.object({
  api_version: z.literal("2"),
  policy_version: z.literal(EVIDENCE_POLICY_VERSION),
  products: z.array(ProductReadModelSchema),
  missing_ids: z.array(EvidenceInteger.check(z.positive())),
});
export type ProductReadModel = z.infer<typeof ProductReadModelSchema>;
export type ProductReadEnvelope = z.infer<typeof ProductReadEnvelopeSchema>;

export type ComparisonDisposition =
  | { comparable: true; relation: "lower" | "equal" | "higher" }
  | { comparable: false; reason: "evidence_unavailable" | "incompatible_basis" | "qualified_value" | "conflicting_evidence" };

export function compareProductNutrient(a: ProductReadModel, b: ProductReadModel, nutrient: NutrientKey): ComparisonDisposition {
  if (a.evidence.state === "conflicting" || b.evidence.state === "conflicting") {
    return { comparable: false, reason: "conflicting_evidence" };
  }
  const left = a.nutrition[nutrient];
  const right = b.nutrition[nutrient];
  if (!a.sources.some((source) => source.observation_id === left.observation_id) || !b.sources.some((source) => source.observation_id === right.observation_id)) {
    return { comparable: false, reason: "evidence_unavailable" };
  }
  return compareNutrientObservations(left, right);
}

/** Exact decimal ordering; never a winner, health judgment, or inferred density. */
export function compareNutrientObservations(a: NutrientObservation, b: NutrientObservation): ComparisonDisposition {
  if (a.state !== "recorded" || b.state !== "recorded" || a.value === null || b.value === null || !a.observation_id || !b.observation_id) {
    return { comparable: false, reason: "evidence_unavailable" };
  }
  if (a.unit !== b.unit || a.basis === "unknown" || a.basis === "per_serving" || a.basis !== b.basis || a.preparation_state === "unknown" || a.preparation_state !== b.preparation_state) {
    return { comparable: false, reason: "incompatible_basis" };
  }
  if (a.qualifier !== "eq" || b.qualifier !== "eq") return { comparable: false, reason: "qualified_value" };
  const [aWhole, aFraction = ""] = a.value.split(".");
  const [bWhole, bFraction = ""] = b.value.split(".");
  const places = Math.max(aFraction.length, bFraction.length);
  const aExact = BigInt(aWhole + aFraction.padEnd(places, "0"));
  const bExact = BigInt(bWhole + bFraction.padEnd(places, "0"));
  return { comparable: true, relation: aExact < bExact ? "lower" : aExact > bExact ? "higher" : "equal" };
}
