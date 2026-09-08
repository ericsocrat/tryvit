import * as z from "zod/mini";
import { EvidenceInteger } from "./integer";
import { ProductReadModelSchema } from "./product-read-model";
import { homeFields, savedAllergenFields, validHomeCounts, validSavedAllergenCounts } from "./home-common";

const ProductId = EvidenceInteger.check(z.positive());
const HomeProduct = z.object({ product_id: ProductId, product: z.nullable(ProductReadModelSchema) }).check(z.refine((entry) => !entry.product || entry.product_id === entry.product.product_id, "Home product identity mismatch"));
const Recent = z.safeExtend(HomeProduct, { viewed_at: z.iso.datetime({ offset: true }) });
const Favorite = z.safeExtend(HomeProduct, { added_at: z.iso.datetime({ offset: true }) });
const Match = z.object({
  allergen: z.string().check(z.minLength(1)), kind: z.enum(["contains", "traces"]),
  state: z.enum(["recorded", "unverified"]), observation_id: z.nullable(z.uuid()),
}).check(z.refine((match) => match.state !== "recorded" || match.observation_id !== null, "Recorded allergen requires a source"));
const WarningProduct = z.safeExtend(HomeProduct, { matches: z.array(Match).check(z.minLength(1)) }).check(z.superRefine((entry, ctx) => {
  for (const match of entry.matches) {
    if (entry.product && !entry.product.allergens[match.kind].some((assertion) => assertion.name === match.allergen && assertion.state === match.state && assertion.observation_id === match.observation_id)) {
      ctx.addIssue({ code: "custom", message: "Allergen match must agree with canonical positive evidence" });
    }
    if (match.observation_id && !entry.product?.sources.some((source) => source.observation_id === match.observation_id)) {
      ctx.addIssue({ code: "custom", message: "Allergen match does not resolve to a product source" });
    }
  }
}));
export const SavedAllergenMatchesSchema = z.object({
  ...savedAllergenFields,
  products: z.array(WarningProduct).check(z.maxLength(6)),
}).check(z.superRefine((value, ctx) => {
  if (!validSavedAllergenCounts(value)) ctx.addIssue({ code: "custom", message: value.state === "checked" ? "Checked allergen matches require truthful counts and preview" : "Unassessed allergens cannot publish a completed count" });
  if (!value.includes_traces && value.products.some((entry) => entry.matches.some((match) => match.kind === "traces"))) ctx.addIssue({ code: "custom", message: "Traces must respect the selected preference" });
  if (new Set(value.products.map((entry) => entry.product_id)).size !== value.products.length) ctx.addIssue({ code: "custom", message: "Allergen product matches must be unique" });
}));
export const HomeReadModelSchema = z.strictObject({
  ...homeFields,
  recently_viewed: z.array(Recent).check(z.maxLength(8)), favorites_preview: z.array(Favorite).check(z.maxLength(6)),
  saved_allergen_matches: SavedAllergenMatchesSchema,
}).check(z.superRefine((value, ctx) => {
  if (!validHomeCounts(value)) ctx.addIssue({ code: "custom", message: "Home membership counts do not match previews" });
  for (const rows of [value.recently_viewed, value.favorites_preview]) {
    if (new Set(rows.map((row) => row.product_id)).size !== rows.length) ctx.addIssue({ code: "custom", message: "Home preview product IDs must be unique" });
  }
}));
export type HomeReadModel = z.infer<typeof HomeReadModelSchema>;
export type HomeProductEntry = z.infer<typeof HomeProduct>;
export type SavedAllergenMatches = z.infer<typeof SavedAllergenMatchesSchema>;
