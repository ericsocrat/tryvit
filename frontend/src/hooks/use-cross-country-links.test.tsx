import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { RpcResult } from "@/lib/types";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetCrossCountryLinks = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

vi.mock("@/lib/api", () => ({
  getCrossCountryLinks: (...args: unknown[]) =>
    mockGetCrossCountryLinks(...args),
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

import { useCrossCountryLinks } from "./use-cross-country-links";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useCrossCountryLinks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches cross-country links for a product", async () => {
    const links = [
      { linked_product_id: 200, country: "DE", link_type: "identical" },
    ];
    mockGetCrossCountryLinks.mockResolvedValue(okResult(links));

    const { result } = renderHook(() => useCrossCountryLinks(42), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(links);
    expect(mockGetCrossCountryLinks).toHaveBeenCalledWith(
      expect.anything(),
      42,
    );
  });

  it("is disabled when enabled=false", () => {
    const { result } = renderHook(
      () => useCrossCountryLinks(42, false),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetCrossCountryLinks).not.toHaveBeenCalled();
  });

  it("throws on API error", async () => {
    mockGetCrossCountryLinks.mockResolvedValue(
      errResult("Links not found"),
    );

    const { result } = renderHook(() => useCrossCountryLinks(42), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Links not found");
  });
});
