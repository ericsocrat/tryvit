// ─── TanStack Query hooks for Product Comparisons ───────────────────────────

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  saveComparison,
  getSavedComparisons,
  deleteComparison,
} from "@/lib/api";
import { queryKeys, staleTimes } from "@/lib/query-keys";

// ─── Queries ────────────────────────────────────────────────────────────────

/** Fetch the user's saved comparisons (paginated). */
export function useSavedComparisons(
  limit?: number,
  offset?: number,
) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.savedComparisons,
    queryFn: async () => {
      const result = await getSavedComparisons(supabase, limit, offset);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.savedComparisons,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Save a comparison (authenticated). */
export function useSaveComparison() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productIds,
      title,
    }: {
      productIds: number[];
      title?: string;
    }) => {
      const result = await saveComparison(supabase, productIds, title);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.savedComparisons,
      });
    },
  });
}

/** Delete a saved comparison. */
export function useDeleteComparison() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (comparisonId: string) => {
      const result = await deleteComparison(supabase, comparisonId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.savedComparisons,
      });
    },
  });
}
