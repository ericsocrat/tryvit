import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { callValidatedRpc } from "@/lib/rpc";
import { queryKeys } from "@/lib/query-keys";
import { ProductReadModelSchema, EVIDENCE_POLICY_VERSION } from "./product-read-model";

export const SavedListSchema = z.object({
  api_version: z.literal("2"), policy_version: z.literal(EVIDENCE_POLICY_VERSION),
  list_id: z.uuid(), list_name: z.string(), list_type: z.enum(["custom", "favorites", "avoid"]), description: z.string().nullable(),
  share_enabled: z.boolean(), share_token: z.string().nullable(), total_count: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(100), offset: z.number().int().nonnegative(),
  items: z.array(z.object({ item_id: z.uuid(), product_id: z.number().int().positive(), position: z.number().int(), notes: z.string().nullable(), added_at: z.string(), product: ProductReadModelSchema.nullable() })
    .refine((item) => item.product === null || item.product.product_id === item.product_id, "Saved product identity mismatch")).max(100),
}).refine((data) => data.items.length <= data.limit && data.total_count >= data.items.length, "Invalid saved membership count");
export type SavedListEnvelope = z.infer<typeof SavedListSchema>;
export const WatchedProductsSchema = z.object({
  api_version: z.literal("2"), policy_version: z.literal(EVIDENCE_POLICY_VERSION), total: z.number().int().nonnegative(),
  page: z.number().int().positive(), page_size: z.number().int().min(1).max(100), total_pages: z.number().int().positive(),
  items: z.array(z.object({ watch_id: z.number().int().positive(), product_id: z.number().int().positive(), watched_since: z.string(), product: ProductReadModelSchema.nullable() })
    .refine((item) => item.product === null || item.product.product_id === item.product_id, "Watched product identity mismatch")).max(100),
}).refine((data) => data.items.length <= data.page_size && data.total >= data.items.length, "Invalid watched membership count");
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
