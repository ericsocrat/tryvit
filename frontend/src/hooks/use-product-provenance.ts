"use client";

import { getProductProvenance } from "@/lib/api";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import type { ProductProvenance } from "@/lib/types";
import { useQueries, useQuery } from "@tanstack/react-query";

export type ProvenanceDisposition =
  | "confirmed"
  | "provisional"
  | "not_collected"
  | "expired";

const SCORE_PROVENANCE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function hasFieldSources(provenance: ProductProvenance): boolean {
  return Object.keys(provenance.field_sources ?? {}).length > 0;
}

function hasUsableScoreProvenance(provenance: ProductProvenance): boolean {
  const scoreSource = provenance.field_sources?.unhealthiness_score;
  if (!scoreSource || scoreSource.confidence < 0.5) return false;

  const updatedAt = Date.parse(scoreSource.last_updated);
  if (!Number.isFinite(updatedAt)) return false;

  const ageMs = Date.now() - updatedAt;
  return ageMs >= 0 && ageMs <= SCORE_PROVENANCE_MAX_AGE_MS;
}

export function getProvenanceDisposition(
  provenance: ProductProvenance,
): ProvenanceDisposition {
  if (!hasFieldSources(provenance) || provenance.overall_trust_score == null) {
    return "not_collected";
  }
  if (provenance.freshness_status === "expired") return "expired";
  if (
    provenance.freshness_status !== "fresh" ||
    provenance.overall_trust_score < 0.8 ||
    provenance.data_completeness_pct == null ||
    provenance.data_completeness_pct < 100
  ) {
    return "provisional";
  }
  return "confirmed";
}

export function canRecommendFromProvenance(
  provenance: ProductProvenance | undefined,
): boolean {
  if (!provenance) return false;
  const disposition = getProvenanceDisposition(provenance);
  return (
    hasUsableScoreProvenance(provenance) &&
    (disposition === "confirmed" ||
      (disposition === "provisional" &&
        provenance.overall_trust_score != null &&
        provenance.overall_trust_score >= 0.5))
  );
}

async function fetchProductProvenance(productId: number) {
  const result = await getProductProvenance(createClient(), productId);
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

export function useProductProvenance(
  productId: number,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: queryKeys.productProvenance(productId),
    queryFn: () => fetchProductProvenance(productId),
    staleTime: staleTimes.productProvenance,
    enabled: enabled && Number.isFinite(productId) && productId > 0,
  });
}

export function useProductProvenanceMap(productIds: readonly number[]) {
  const uniqueIds = [...new Set(productIds)].toSorted((a, b) => a - b);
  const queries = useQueries({
    queries: uniqueIds.map((productId) => ({
      queryKey: queryKeys.productProvenance(productId),
      queryFn: () => fetchProductProvenance(productId),
      staleTime: staleTimes.productProvenance,
      enabled: Number.isFinite(productId) && productId > 0,
    })),
  });

  return Object.fromEntries(
    uniqueIds.map((productId, index) => [productId, queries[index]]),
  );
}
