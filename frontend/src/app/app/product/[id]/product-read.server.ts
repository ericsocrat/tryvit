import "server-only";
import { cache } from "react";
import { getProductReadModels } from "@/lib/evidence/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupportedLanguage } from "@/stores/language-store";

/** Metadata and RSC hydration share one validated, identity-matched read. */
export const fetchProductEvidence = cache(async (id: string, language: SupportedLanguage) => {
  const productId = /^[1-9][0-9]*$/.test(id) ? Number(id) : Number.NaN;
  if (!Number.isSafeInteger(productId)) return null;
  try {
    const result = await getProductReadModels(await createServerSupabaseClient(), [productId], language);
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
});
