import {
    useDeleteComparison,
    useSaveComparison,
    useSavedComparisons,
} from "@/hooks/use-compare";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetSavedComparisons = vi.fn();
const mockSaveComparison = vi.fn();
const mockDeleteComparison = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

vi.mock("@/lib/api", () => ({
  getSavedComparisons: (...args: unknown[]) => mockGetSavedComparisons(...args),
  saveComparison: (...args: unknown[]) => mockSaveComparison(...args),
  deleteComparison: (...args: unknown[]) => mockDeleteComparison(...args),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useSavedComparisons", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches saved comparisons", async () => {
    const data = { comparisons: [] };
    mockGetSavedComparisons.mockResolvedValue({ ok: true, data });

    const { result } = renderHook(() => useSavedComparisons(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
  });

  it("passes limit and offset to API", async () => {
    const data = { comparisons: [{ id: "c1" }] };
    mockGetSavedComparisons.mockResolvedValue({ ok: true, data });

    const { result } = renderHook(() => useSavedComparisons(10, 20), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetSavedComparisons).toHaveBeenCalledWith(
      expect.anything(),
      10,
      20,
    );
  });

  it("throws on error result", async () => {
    mockGetSavedComparisons.mockResolvedValue({
      ok: false,
      error: { code: "ERR", message: "unauthorized" },
    });

    const { result } = renderHook(() => useSavedComparisons(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("unauthorized");
  });
});

describe("useSaveComparison", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls saveComparison API and returns data", async () => {
    const data = { comparison_id: "c1", share_token: "tok-123" };
    mockSaveComparison.mockResolvedValue({ ok: true, data });

    const { result } = renderHook(() => useSaveComparison(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ productIds: [1, 2], title: "Test" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
  });

  it("saves comparison without title", async () => {
    const data = { comparison_id: "c2" };
    mockSaveComparison.mockResolvedValue({ ok: true, data });

    const { result } = renderHook(() => useSaveComparison(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ productIds: [5, 6] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSaveComparison).toHaveBeenCalledWith(
      expect.anything(),
      [5, 6],
      undefined,
    );
  });

  it("throws on error result", async () => {
    mockSaveComparison.mockResolvedValue({
      ok: false,
      error: { code: "ERR", message: "limit reached" },
    });

    const { result } = renderHook(() => useSaveComparison(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ productIds: [1, 2] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("limit reached");
  });
});

describe("useDeleteComparison", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls deleteComparison API", async () => {
    mockDeleteComparison.mockResolvedValue({
      ok: true,
      data: { success: true },
    });

    const { result } = renderHook(() => useDeleteComparison(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("comp-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeleteComparison).toHaveBeenCalledWith(
      expect.anything(),
      "comp-1",
    );
  });

  it("throws on error result", async () => {
    mockDeleteComparison.mockResolvedValue({
      ok: false,
      error: { code: "ERR", message: "not found" },
    });

    const { result } = renderHook(() => useDeleteComparison(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("comp-1");

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
