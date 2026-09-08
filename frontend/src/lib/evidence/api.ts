import type { SupabaseClient } from "@supabase/supabase-js";
import { callValidatedRpc } from "@/lib/rpc";
import { ProductReadEnvelopeSchema } from "./product-read-model";

export async function getProductReadModels(supabase: SupabaseClient, ids: readonly number[], language: string) {
  if (ids.length > 100 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return { ok: false as const, error: { code: "INVALID_SELECTION", message: "Choose up to 100 valid products." } };
  }
  return callValidatedRpc(supabase, "api_product_read_model", ProductReadEnvelopeSchema, {
    p_product_ids: [...new Set(ids)],
    p_language: language,
  });
}

export const evidenceQueryKeys = {
  products: (ids: readonly number[], language: string) => ["evidence-products-v2", { ids: [...new Set(ids)], language }] as const,
};
