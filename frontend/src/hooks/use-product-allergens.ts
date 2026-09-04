// ─── Hook: batch-fetch & match product allergens against user preferences ───
// Returns a map of productId → AllergenWarning[] for the current page of results.
// Only fetches when user has allergen preferences configured.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getProductAllergens } from "@/lib/api";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { useUserPreferencesQuery } from "@/hooks/use-user-preferences-query";
import {
  matchProductAllergens,
  type AllergenWarning,
} from "@/lib/allergen-matching";

/** Map of product_id → matched allergen warnings */
export type AllergenWarningMap = Readonly<Record<number, AllergenWarning[]>>;

export interface ProductAllergenWarningState {
  readonly warnings: AllergenWarningMap;
  readonly enabled: boolean;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly refetch: () => void;
}

/**
 * Batch-fetch allergen data for a page of products and match against user preferences.
 *
 * @param productIds - Array of product IDs from the current page of search/category/dashboard results
 * @returns Map of productId → AllergenWarning[] (empty map when no preferences or no data)
 *
 * @example
 * ```tsx
 * const products = searchData?.results ?? [];
 * const allergenMap = useProductAllergenWarnings(products.map(p => p.product_id));
 * // Then for each product: allergenMap[product.product_id] ?? []
 * ```
 */
export function useProductAllergenWarnings(
  productIds: number[],
): ProductAllergenWarningState {
  const supabase = createClient();
  const preferenceQuery = useUserPreferencesQuery();
  const prefs = preferenceQuery.data;

  const avoidAllergens = useMemo(
    () => prefs?.avoid_allergens ?? [],
    [prefs?.avoid_allergens],
  );
  const treatMayContainAsUnsafe =
    prefs?.treat_may_contain_as_unsafe ?? false;
  const hasAllergenPrefs = avoidAllergens.length > 0;

  const query = useQuery({
    queryKey: queryKeys.productAllergens(productIds),
    queryFn: async () => {
      const result = await getProductAllergens(supabase, productIds);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    enabled: productIds.length > 0 && hasAllergenPrefs,
    staleTime: staleTimes.productAllergens,
  });

  // Memoize the matching computation (runs when raw data or preferences change)
  const warnings = useMemo(() => {
    if (!query.data || !hasAllergenPrefs) return {};

    const result: Record<number, AllergenWarning[]> = {};
    for (const [idStr, allergens] of Object.entries(query.data)) {
      const warnings = matchProductAllergens(
        allergens,
        avoidAllergens,
        treatMayContainAsUnsafe,
      );
      if (warnings.length > 0) {
        result[Number(idStr)] = warnings;
      }
    }
    return result;
  }, [query.data, avoidAllergens, treatMayContainAsUnsafe, hasAllergenPrefs]);

  return {
    warnings,
    // A pending or failed preference read is itself relevant evidence. Keep the
    // surface active so consumers show loading/unavailable instead of implying
    // that the user has no configured allergens.
    enabled:
      productIds.length > 0 &&
      (preferenceQuery.isPending ||
        Boolean(preferenceQuery.error) ||
        hasAllergenPrefs),
    isLoading: preferenceQuery.isPending || query.isLoading,
    error: preferenceQuery.error ?? query.error,
    refetch: () => {
      if (preferenceQuery.error || prefs === undefined) {
        void preferenceQuery.refetch();
        return;
      }
      void query.refetch();
    },
  };
}
