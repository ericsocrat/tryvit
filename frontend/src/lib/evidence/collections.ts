import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod/mini";
import { EvidenceInteger } from "./integer";
import { callValidatedRpc } from "@/lib/rpc";
import { queryKeys } from "@/lib/query-keys";
import { ProductReadModelSchema, EVIDENCE_POLICY_VERSION } from "./product-read-model";

export const SavedListSchema = z.object({
  api_version: z.literal("2"), policy_version: z.literal(EVIDENCE_POLICY_VERSION),
  list_id: z.uuid(), list_name: z.string(), list_type: z.enum(["custom", "favorites", "avoid"]), description: z.nullable(z.string()),
  share_enabled: z.boolean(), share_token: z.nullable(z.string()), total_count: EvidenceInteger.check(z.nonnegative()),
  limit: EvidenceInteger.check(z.minimum(1)).check(z.maximum(100)), offset: EvidenceInteger.check(z.nonnegative()),
  items: z.array(z.object({ item_id: z.uuid(), product_id: EvidenceInteger.check(z.positive()), position: EvidenceInteger, notes: z.nullable(z.string()), added_at: z.string(), product: z.nullable(ProductReadModelSchema) }).check(z.refine((item) => item.product === null || item.product.product_id === item.product_id, "Saved product identity mismatch"))).check(z.maxLength(100)),
}).check(z.refine((data) => data.items.length <= data.limit && data.total_count >= data.items.length, "Invalid saved membership count"));
export type SavedListEnvelope = z.infer<typeof SavedListSchema>;
export const WatchedProductsSchema = z.object({
  api_version: z.literal("2"), policy_version: z.literal(EVIDENCE_POLICY_VERSION), total: EvidenceInteger.check(z.nonnegative()),
  page: EvidenceInteger.check(z.positive()), page_size: EvidenceInteger.check(z.minimum(1)).check(z.maximum(100)), total_pages: EvidenceInteger.check(z.positive()),
  items: z.array(z.object({ watch_id: EvidenceInteger.check(z.positive()), product_id: EvidenceInteger.check(z.positive()), watched_since: z.string(), product: z.nullable(ProductReadModelSchema) }).check(z.refine((item) => item.product === null || item.product.product_id === item.product_id, "Watched product identity mismatch"))).check(z.maxLength(100)),
}).check(z.refine((data) => data.items.length <= data.page_size && data.total >= data.items.length, "Invalid watched membership count"));
export type WatchedProductsEnvelope = z.infer<typeof WatchedProductsSchema>;
export const collectionQueryKeys = {
  list: (id: string, offset: number, language: string) => [...queryKeys.listItems(id), { contract: "v2", offset, language }] as const,
  watched: (page: number, language: string) => [...queryKeys.watchlist(page), { contract: "v2", language }] as const,
};
export function getSavedList(client: SupabaseClient, id: string, offset: number, language: string) {
  return callValidatedRpc(client, "api_saved_list_read_model", SavedListSchema, { p_list_id: id, p_limit: 20, p_offset: offset, p_language: language });
}
export function getWatchedProducts(client: SupabaseClient, page: number, language: string) {
  return callValidatedRpc(client, "api_watched_products_read_model", WatchedProductsSchema, { p_page: page, p_page_size: 20, p_language: language });
}
