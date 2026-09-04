import { useProductAllergenWarnings } from "@/hooks/use-product-allergens";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetProductAllergens = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

vi.mock("@/lib/api", () => ({
  getProductAllergens: (...args: unknown[]) =>
    mockGetProductAllergens(...args),
}));

const mockRefetchPreferences = vi.fn();
const mockUseUserPreferencesQuery = vi.fn();

vi.mock("@/hooks/use-user-preferences-query", () => ({
  useUserPreferencesQuery: () => mockUseUserPreferencesQuery(),
}));

const mockMatchProductAllergens = vi.fn();

vi.mock("@/lib/allergen-matching", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const original = await importOriginal<typeof import("@/lib/allergen-matching")>();
  return {
    ...original,
    matchProductAllergens: (...args: unknown[]) =>
      mockMatchProductAllergens(...args),
  };
});

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

const milkWarning = {
  tag: "milk",
  labelKey: "allergens.milk",
  icon: "🥛",
  type: "contains" as const,
};

const glutenWarning = {
  tag: "gluten",
  labelKey: "allergens.gluten",
  icon: "🌾",
  type: "traces" as const,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useProductAllergenWarnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserPreferencesQuery.mockReturnValue({
      data: {
        avoid_allergens: ["milk", "gluten"],
        treat_may_contain_as_unsafe: false,
      },
      error: null,
      isPending: false,
      refetch: mockRefetchPreferences,
    });
  });

  it("returns allergen warnings for matching products", async () => {
    const allergenData = {
      "42": { contains: ["milk"], traces: [] },
      "99": { contains: ["gluten"], traces: ["milk"] },
    };
    mockGetProductAllergens.mockResolvedValue({ ok: true, data: allergenData });
    mockMatchProductAllergens
      .mockReturnValueOnce([milkWarning])
      .mockReturnValueOnce([glutenWarning]);

    const { result } = renderHook(
      () => useProductAllergenWarnings([42, 99]),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.warnings).toEqual({
      42: [milkWarning],
      99: [glutenWarning],
    }));

    expect(mockGetProductAllergens).toHaveBeenCalledWith(
      expect.anything(),
      [42, 99],
    );
  });

  it("returns empty map when no allergen preferences", () => {
    mockUseUserPreferencesQuery.mockReturnValue({
      data: {
        avoid_allergens: [],
        treat_may_contain_as_unsafe: false,
      },
      error: null,
      isPending: false,
      refetch: mockRefetchPreferences,
    });

    const { result } = renderHook(
      () => useProductAllergenWarnings([42]),
      { wrapper: createWrapper() },
    );

    // Query should be disabled (no allergen preferences)
    expect(result.current.warnings).toEqual({});
    expect(result.current.enabled).toBe(false);
    expect(mockGetProductAllergens).not.toHaveBeenCalled();
  });

  it("keeps preference loading visible instead of treating it as no allergens", () => {
    mockUseUserPreferencesQuery.mockReturnValue({
      data: undefined,
      error: null,
      isPending: true,
      refetch: mockRefetchPreferences,
    });

    const { result } = renderHook(
      () => useProductAllergenWarnings([42]),
      { wrapper: createWrapper() },
    );

    expect(result.current.warnings).toEqual({});
    expect(result.current.enabled).toBe(true);
    expect(result.current.isLoading).toBe(true);
    expect(mockGetProductAllergens).not.toHaveBeenCalled();
  });

  it("keeps preference errors visible and retries the preference read", () => {
    const preferenceError = new Error("preferences unavailable");
    mockUseUserPreferencesQuery.mockReturnValue({
      data: undefined,
      error: preferenceError,
      isPending: false,
      refetch: mockRefetchPreferences,
    });

    const { result } = renderHook(
      () => useProductAllergenWarnings([42]),
      { wrapper: createWrapper() },
    );

    expect(result.current.warnings).toEqual({});
    expect(result.current.enabled).toBe(true);
    expect(result.current.error).toBe(preferenceError);
    expect(mockGetProductAllergens).not.toHaveBeenCalled();

    result.current.refetch();
    expect(mockRefetchPreferences).toHaveBeenCalledOnce();
  });

  it("returns empty map when productIds is empty", () => {
    const { result } = renderHook(
      () => useProductAllergenWarnings([]),
      { wrapper: createWrapper() },
    );

    expect(result.current.warnings).toEqual({});
    expect(result.current.enabled).toBe(false);
    expect(mockGetProductAllergens).not.toHaveBeenCalled();
  });

  it("excludes products with no matching warnings", async () => {
    const allergenData = {
      "42": { contains: ["milk"], traces: [] },
      "55": { contains: ["soybeans"], traces: [] },
    };
    mockGetProductAllergens.mockResolvedValue({ ok: true, data: allergenData });
    mockMatchProductAllergens
      .mockReturnValueOnce([milkWarning])
      .mockReturnValueOnce([]); // No match for product 55

    const { result } = renderHook(
      () => useProductAllergenWarnings([42, 55]),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.warnings).toEqual({
      42: [milkWarning],
    }));

    // Product 55 should NOT be in the result (empty warnings)
    expect(result.current.warnings[55]).toBeUndefined();
  });

  it("passes avoidAllergens and treatMayContainAsUnsafe to matcher", async () => {
    mockUseUserPreferencesQuery.mockReturnValue({
      data: {
        avoid_allergens: ["peanuts"],
        treat_may_contain_as_unsafe: true,
      },
      error: null,
      isPending: false,
      refetch: mockRefetchPreferences,
    });

    const allergenData = {
      "42": { contains: [], traces: ["peanuts"] },
    };
    mockGetProductAllergens.mockResolvedValue({ ok: true, data: allergenData });
    mockMatchProductAllergens.mockReturnValue([]);

    renderHook(
      () => useProductAllergenWarnings([42]),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(mockMatchProductAllergens).toHaveBeenCalledWith(
        { contains: [], traces: ["peanuts"] },
        ["peanuts"],
        true,
      ),
    );
  });

  it("keeps API errors visible instead of collapsing to an empty warning map", async () => {
    mockGetProductAllergens.mockResolvedValue({
      ok: false,
      error: { code: "ERR", message: "server error" },
    });

    const { result } = renderHook(
      () => useProductAllergenWarnings([42]),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.warnings).toEqual({});
    expect(result.current.enabled).toBe(true);
  });

  it("returns warnings for multiple products", async () => {
    const allergenData = {
      "1": { contains: ["milk"], traces: [] },
      "2": { contains: ["gluten"], traces: ["milk"] },
      "3": { contains: ["milk", "gluten"], traces: [] },
    };
    mockGetProductAllergens.mockResolvedValue({ ok: true, data: allergenData });
    mockMatchProductAllergens
      .mockReturnValueOnce([milkWarning])
      .mockReturnValueOnce([glutenWarning])
      .mockReturnValueOnce([milkWarning, glutenWarning]);

    const { result } = renderHook(
      () => useProductAllergenWarnings([1, 2, 3]),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(Object.keys(result.current.warnings)).toHaveLength(3),
    );
    expect(result.current.warnings[1]).toEqual([milkWarning]);
    expect(result.current.warnings[2]).toEqual([glutenWarning]);
    expect(result.current.warnings[3]).toEqual([milkWarning, glutenWarning]);
  });

  it("returns empty map when all products have no warnings", async () => {
    const allergenData = {
      "42": { contains: ["soybeans"], traces: [] },
    };
    mockGetProductAllergens.mockResolvedValue({ ok: true, data: allergenData });
    mockMatchProductAllergens.mockReturnValue([]);

    const { result } = renderHook(
      () => useProductAllergenWarnings([42]),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(mockMatchProductAllergens).toHaveBeenCalled());
    expect(result.current.warnings).toEqual({});
  });
});
