import type { SupabaseClient } from "@supabase/supabase-js";
import { callValidatedRpc } from "@/lib/rpc";
import { queryKeys } from "@/lib/query-keys";
import type { UserPreferences } from "@/lib/types";
import { EmptyHomeReadModelSchema } from "./home-common";
import type { HomeReadModel } from "./home-schema";
export type { HomeReadModel, HomeProductEntry, SavedAllergenMatches } from "./home-schema";

/** Validate empty homes without loading unused product-field validators.
 * Nonempty responses must finish full validation before callers receive data.
 */
const HomeResponseValidator = {
  async safeParse(value: unknown) {
    const empty = EmptyHomeReadModelSchema.safeParse(value);
    if (empty.success) return empty;
    const { HomeReadModelSchema } = await import("./home-schema");
    return HomeReadModelSchema.safeParse(value);
  },
};

export const homeQueryKey = (preferences: UserPreferences | undefined, language: string) => [
  ...queryKeys.dashboard, { contract: "evidence-first-v1", language, user: preferences?.user_id ?? null,
    country: preferences?.country ?? null, updatedAt: preferences?.updated_at ?? null,
    allergens: [...(preferences?.avoid_allergens ?? [])].sort(), traces: preferences?.treat_may_contain_as_unsafe ?? null },
] as const;
export async function getHomeReadModel(client: SupabaseClient, language: string) {
  const result = await callValidatedRpc<HomeReadModel>(client, "api_home_read_model", HomeResponseValidator, { p_language: language });
  if (result.ok && result.data.language !== language) return { ok: false as const, error: { code: "RESPONSE_LANGUAGE_MISMATCH", message: "Home response language did not match the request." } };
  return result;
}
