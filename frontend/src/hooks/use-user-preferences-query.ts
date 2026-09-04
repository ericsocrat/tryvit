"use client";

import { getUserPreferences } from "@/lib/api";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";

/**
 * Shared preference query used wherever controls must not be hydrated from
 * guessed defaults after a failed read.
 */
export function useUserPreferencesQuery() {
  const supabase = createClient();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: queryKeys.preferences,
    queryFn: async () => {
      const result = await getUserPreferences(supabase);
      if (!result.ok) {
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      }
      if (!result.data) {
        throw Object.assign(new Error("Preferences response was empty"), {
          code: "EMPTY_RESPONSE",
        });
      }
      return result.data;
    },
    staleTime: staleTimes.preferences,
  });

  return { data, error, isPending, refetch };
}
