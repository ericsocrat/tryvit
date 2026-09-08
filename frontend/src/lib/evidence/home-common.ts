import * as z from "zod/mini";
import { EVIDENCE_POLICY_VERSION } from "./policy";

/** Shared by full and empty Home contracts so their checks cannot diverge. */
const Count = z.int().check(z.nonnegative());
export const homeFields = {
  api_version: z.literal("2"), policy_version: z.literal(EVIDENCE_POLICY_VERSION),
  language: z.enum(["en", "pl", "de"]), country: z.nullable(z.enum(["PL", "DE"])),
  stats: z.strictObject({ total_scanned: Count, total_viewed: Count, favorites_count: Count, lists_count: Count, custom_lists_count: Count }),
};
export const savedAllergenFields = {
  state: z.enum(["checked", "not_configured", "preferences_unavailable"]),
  count: z.nullable(Count), includes_traces: z.boolean(),
};

export function validSavedAllergenCounts(value: { state: string; count: number | null; products: unknown[] }) {
  return value.state === "checked"
    ? value.count !== null && value.count >= value.products.length && (value.count === 0 || value.products.length > 0)
    : value.count === null && value.products.length === 0;
}

export function validHomeCounts(value: {
  stats: z.infer<typeof homeFields.stats>;
  recently_viewed: unknown[]; favorites_preview: unknown[];
  saved_allergen_matches: { count: number | null };
}) {
  return value.stats.total_viewed >= value.recently_viewed.length && value.stats.favorites_count >= value.favorites_preview.length && value.stats.custom_lists_count <= value.stats.lists_count && (value.saved_allergen_matches.count ?? 0) <= value.stats.favorites_count;
}

/** No product data is accepted here. Any nonempty payload uses the full schema. */
export const EmptyHomeReadModelSchema = z.strictObject({
  ...homeFields,
  recently_viewed: z.array(z.never()), favorites_preview: z.array(z.never()),
  saved_allergen_matches: z.object({ ...savedAllergenFields, products: z.array(z.never()) })
    .check(z.refine(validSavedAllergenCounts)),
}).check(z.refine(validHomeCounts));
