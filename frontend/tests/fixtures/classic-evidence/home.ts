import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { callValidatedRpc } from "@/lib/rpc";
import { queryKeys } from "@/lib/query-keys";
import type { UserPreferences } from "@/lib/types";
import { EVIDENCE_POLICY_VERSION, ProductReadModelSchema } from "./product-read-model";

const ProductId = z.number().int().positive();
const HomeProduct = z.object({ product_id: ProductId, product: ProductReadModelSchema.nullable() })
  .refine((entry) => !entry.product || entry.product_id === entry.product.product_id, "Home product identity mismatch");
const Recent = HomeProduct.safeExtend({ viewed_at: z.iso.datetime({ offset: true }) });
const Favorite = HomeProduct.safeExtend({ added_at: z.iso.datetime({ offset: true }) });
const Match = z.object({
  allergen: z.string().min(1), kind: z.enum(["contains", "traces"]),
  state: z.enum(["recorded", "unverified"]), observation_id: z.uuid().nullable(),
}).refine((match) => match.state !== "recorded" || match.observation_id !== null, "Recorded allergen requires a source");
const WarningProduct = HomeProduct.safeExtend({ matches: z.array(Match).min(1) }).superRefine((entry, ctx) => {
  for (const match of entry.matches) {
    if (entry.product && !entry.product.allergens[match.kind].some((assertion) => assertion.name === match.allergen && assertion.state === match.state && assertion.observation_id === match.observation_id)) {
      ctx.addIssue({ code: "custom", message: "Allergen match must agree with canonical positive evidence" });
    }
    if (match.observation_id && !entry.product?.sources.some((source) => source.observation_id === match.observation_id)) {
      ctx.addIssue({ code: "custom", message: "Allergen match does not resolve to a product source" });
    }
  }
});
export const SavedAllergenMatchesSchema = z.object({
  state: z.enum(["checked", "not_configured", "preferences_unavailable"]),
  count: z.number().int().nonnegative().nullable(), includes_traces: z.boolean(),
  products: z.array(WarningProduct).max(6),
}).superRefine((value, ctx) => {
  if (value.state === "checked" && (value.count === null || value.count < value.products.length || (value.count > 0 && value.products.length === 0))) ctx.addIssue({ code: "custom", message: "Checked allergen matches require truthful counts and preview" });
  if (value.state !== "checked" && (value.count !== null || value.products.length !== 0)) ctx.addIssue({ code: "custom", message: "Unassessed allergens cannot publish a completed count" });
  if (!value.includes_traces && value.products.some((entry) => entry.matches.some((match) => match.kind === "traces"))) ctx.addIssue({ code: "custom", message: "Traces must respect the selected preference" });
  if (new Set(value.products.map((entry) => entry.product_id)).size !== value.products.length) ctx.addIssue({ code: "custom", message: "Allergen product matches must be unique" });
});
export const HomeReadModelSchema = z.object({
  api_version: z.literal("2"), policy_version: z.literal(EVIDENCE_POLICY_VERSION),
  language: z.enum(["en", "pl", "de"]), country: z.enum(["PL", "DE"]).nullable(),
  recently_viewed: z.array(Recent).max(8), favorites_preview: z.array(Favorite).max(6),
  stats: z.object({ total_scanned: z.number().int().nonnegative(), total_viewed: z.number().int().nonnegative(), favorites_count: z.number().int().nonnegative(), lists_count: z.number().int().nonnegative(), custom_lists_count: z.number().int().nonnegative() }).strict(),
  saved_allergen_matches: SavedAllergenMatchesSchema,
}).strict().superRefine((value, ctx) => {
  if (value.stats.total_viewed < value.recently_viewed.length || value.stats.favorites_count < value.favorites_preview.length || value.stats.custom_lists_count > value.stats.lists_count || (value.saved_allergen_matches.count ?? 0) > value.stats.favorites_count) ctx.addIssue({ code: "custom", message: "Home membership counts do not match previews" });
  for (const rows of [value.recently_viewed, value.favorites_preview]) {
    if (new Set(rows.map((row) => row.product_id)).size !== rows.length) ctx.addIssue({ code: "custom", message: "Home preview product IDs must be unique" });
  }
});
export type HomeReadModel = z.infer<typeof HomeReadModelSchema>;
export type HomeProductEntry = z.infer<typeof HomeProduct>;
export type SavedAllergenMatches = z.infer<typeof SavedAllergenMatchesSchema>;
export const homeQueryKey = (preferences: UserPreferences | undefined, language: string) => [
  ...queryKeys.dashboard, { contract: "evidence-first-v1", language, user: preferences?.user_id ?? null,
    country: preferences?.country ?? null, updatedAt: preferences?.updated_at ?? null,
    allergens: [...(preferences?.avoid_allergens ?? [])].sort(), traces: preferences?.treat_may_contain_as_unsafe ?? null },
] as const;
export async function getHomeReadModel(client: SupabaseClient, language: string) {
  const result = await callValidatedRpc(client, "api_home_read_model", HomeReadModelSchema, { p_language: language });
  if (result.ok && result.data.language !== language) return { ok: false as const, error: { code: "RESPONSE_LANGUAGE_MISMATCH", message: "Home response language did not match the request." } };
  return result;
}
