import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { RpcResult } from "@/lib/types";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetBetterAlternativesV2 = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

vi.mock("@/lib/api", () => ({
  getBetterAlternativesV2: (...args: unknown[]) =>
    mockGetBetterAlternativesV2(...args),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function okResult<T>(data: T): RpcResult<T> {
  return { ok: true, data };
}

function errResult(message: string): RpcResult<never> {
  return { ok: false, error: { code: "ERR", message } };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ─── Import under test ─────────────────────────────────────────────────────

import { useAlternativesV2 } from "./use-alternatives-v2";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useAlternativesV2", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches alternatives with default params", async () => {
    const alternatives = [{ product_id: 99, score: 10 }];
    mockGetBetterAlternativesV2.mockResolvedValue(okResult(alternatives));

    const { result } = renderHook(
      () => useAlternativesV2({ productId: 42 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(alternatives);
    expect(mockGetBetterAlternativesV2).toHaveBeenCalledWith(
      expect.anything(),
      42,
      expect.objectContaining({
        p_cross_category: false,
        p_limit: 5,
        p_prefer_no_palm_oil: false,
      }),
    );
  });

  it("passes custom params to API", async () => {
    mockGetBetterAlternativesV2.mockResolvedValue(okResult([]));

    const { result } = renderHook(
      () =>
        useAlternativesV2({
          productId: 42,
          crossCategory: true,
          limit: 10,
          preferNoPalmOil: true,
          maxConcernTier: 1,
          dietPreference: "vegan",
          avoidAllergens: ["gluten", "milk"],
          strictDiet: true,
          strictAllergen: false,
          treatMayContain: true,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetBetterAlternativesV2).toHaveBeenCalledWith(
      expect.anything(),
      42,
      {
        p_cross_category: true,
        p_limit: 10,
        p_health_profile_id: undefined,
        p_prefer_no_palm_oil: true,
        p_max_concern_tier: 1,
        p_diet_preference: "vegan",
        p_avoid_allergens: ["gluten", "milk"],
        p_strict_diet: true,
        p_strict_allergen: false,
        p_treat_may_contain: true,
      },
    );
  });

  it("is disabled when enabled=false", () => {
    const { result } = renderHook(
      () => useAlternativesV2({ productId: 42, enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetBetterAlternativesV2).not.toHaveBeenCalled();
  });

  it("throws on API error", async () => {
    mockGetBetterAlternativesV2.mockResolvedValue(
      errResult("No alternatives found"),
    );

    const { result } = renderHook(
      () => useAlternativesV2({ productId: 42 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No alternatives found");
  });
});
