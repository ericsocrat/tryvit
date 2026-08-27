import {
  canRecommendFromProvenance,
  getProvenanceDisposition,
  useProductProvenance,
  useProductProvenanceMap,
} from "@/hooks/use-product-provenance";
import type { ProductProvenance } from "@/lib/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetProductProvenance = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

vi.mock("@/lib/api", () => ({
  getProductProvenance: (...args: unknown[]) =>
    mockGetProductProvenance(...args),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function provenance(
  overrides: Partial<ProductProvenance> = {},
): ProductProvenance {
  return {
    api_version: "2026-02-27",
    product_id: 42,
    product_name: "Test Product",
    overall_trust_score: 0.9,
    freshness_status: "fresh",
    source_count: 2,
    data_completeness_pct: 100,
    field_sources: {
      unhealthiness_score: {
        source: "Open Food Facts",
        last_updated: new Date().toISOString(),
        confidence: 0.9,
      },
    },
    trust_explanation: "Current evidence",
    weakest_area: { field: "calories", confidence: 0.9 },
    ...overrides,
  };
}

describe("product provenance disposition", () => {
  it("distinguishes confirmed, provisional, not-collected, and expired evidence", () => {
    expect(getProvenanceDisposition(provenance())).toBe("confirmed");
    expect(
      getProvenanceDisposition(
        provenance({ freshness_status: "stale" }),
      ),
    ).toBe("provisional");
    expect(
      getProvenanceDisposition(provenance({ field_sources: {} })),
    ).toBe("not_collected");
    expect(
      getProvenanceDisposition(
        provenance({ freshness_status: "expired" }),
      ),
    ).toBe("expired");
    expect(
      getProvenanceDisposition(
        provenance({
          field_sources: {
            unhealthiness_score: {
              source: "Open Food Facts",
              last_updated: "2999-01-01T00:00:00Z",
              confidence: 0.9,
            },
          },
        }),
      ),
    ).toBe("provisional");
    expect(
      getProvenanceDisposition(
        provenance({
          field_sources: {
            unhealthiness_score: {
              source: "Open Food Facts",
              last_updated: "not-a-date",
              confidence: 0.9,
            },
          },
        }),
      ),
    ).toBe("provisional");
  });

  it("withholds recommendations for absent, uncollected, expired, or low-trust provenance", () => {
    expect(canRecommendFromProvenance(provenance())).toBe(true);
    expect(
      canRecommendFromProvenance(provenance({ freshness_status: "stale" })),
    ).toBe(true);
    expect(canRecommendFromProvenance(provenance({ field_sources: {} }))).toBe(
      false,
    );
    expect(
      canRecommendFromProvenance(
        provenance({ overall_trust_score: 0.3 }),
      ),
    ).toBe(false);
    expect(
      canRecommendFromProvenance(
        provenance({
          field_sources: {
            brand: {
              source: "Open Food Facts",
              last_updated: "2026-08-20T00:00:00Z",
              confidence: 0.9,
            },
          },
        }),
      ),
    ).toBe(false);
    expect(
      canRecommendFromProvenance(
        provenance({
          field_sources: {
            unhealthiness_score: {
              source: "Open Food Facts",
              last_updated: new Date().toISOString(),
              confidence: 0.3,
            },
          },
        }),
      ),
    ).toBe(false);
    expect(
      canRecommendFromProvenance(
        provenance({
          field_sources: {
            unhealthiness_score: {
              source: "Open Food Facts",
              last_updated: "2025-01-01T00:00:00Z",
              confidence: 0.9,
            },
          },
        }),
      ),
    ).toBe(false);
    expect(
      canRecommendFromProvenance(
        provenance({
          field_sources: {
            unhealthiness_score: {
              source: "Open Food Facts",
              last_updated: "not-a-date",
              confidence: 0.9,
            },
          },
        }),
      ),
    ).toBe(false);
    expect(
      canRecommendFromProvenance(
        provenance({ freshness_status: "expired" }),
      ),
    ).toBe(false);
    expect(canRecommendFromProvenance(undefined)).toBe(false);
  });
});

describe("useProductProvenance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads provenance for one product", async () => {
    mockGetProductProvenance.mockResolvedValue({
      ok: true,
      data: provenance(),
    });
    const { result } = renderHook(() => useProductProvenance(42), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.product_id).toBe(42);
    expect(mockGetProductProvenance).toHaveBeenCalledWith(expect.anything(), 42);
  });

  it("surfaces application-level failure", async () => {
    mockGetProductProvenance.mockResolvedValue({
      ok: false,
      error: { code: "UNAVAILABLE", message: "provenance unavailable" },
    });
    const { result } = renderHook(() => useProductProvenance(42), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("provenance unavailable");
  });

  it("does not fetch an invalid product id", () => {
    const { result } = renderHook(() => useProductProvenance(0), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetProductProvenance).not.toHaveBeenCalled();
  });

  it("loads a deterministic map for comparison products", async () => {
    mockGetProductProvenance.mockImplementation(
      async (_client: unknown, productId: number) => ({
        ok: true,
        data: provenance({ product_id: productId }),
      }),
    );
    const { result } = renderHook(() => useProductProvenanceMap([2, 1, 2]), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current[1]?.isSuccess).toBe(true);
      expect(result.current[2]?.isSuccess).toBe(true);
    });
    expect(mockGetProductProvenance).toHaveBeenCalledTimes(2);
  });
});
