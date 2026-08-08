import { queryKeys } from "@/lib/query-keys";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNoncriticalAppQueriesEnabled } from "./use-noncritical-app-queries";

const mockPathname = vi.fn<() => string>();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, Wrapper };
}

describe("useNoncriticalAppQueriesEnabled", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/app");
  });

  it("defers noncritical work on exact /app while the dashboard is pending", () => {
    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useNoncriticalAppQueriesEnabled(), {
      wrapper: Wrapper,
    });

    expect(result.current).toBe(false);
    expect(queryClient.getQueryState(queryKeys.dashboard)).toBeUndefined();
  });

  it("releases noncritical work after dashboard success without another fetch", async () => {
    const dashboardFetch = vi.fn().mockResolvedValue({ recently_viewed: [] });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => {
        useQuery({
          queryKey: queryKeys.dashboard,
          queryFn: dashboardFetch,
        });
        return useNoncriticalAppQueriesEnabled();
      },
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current).toBe(true));
    expect(dashboardFetch).toHaveBeenCalledOnce();
  });

  it("does not replace the dashboard query function during invalidation", async () => {
    const dashboardFetch = vi.fn().mockResolvedValue({ recently_viewed: [] });
    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(
      () => {
        useQuery({
          queryKey: queryKeys.dashboard,
          queryFn: dashboardFetch,
        });
        return useNoncriticalAppQueriesEnabled();
      },
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current).toBe(true));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    });

    await waitFor(() => expect(dashboardFetch).toHaveBeenCalledTimes(2));
    expect(result.current).toBe(true);
  });

  it("releases noncritical work after dashboard error", async () => {
    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useNoncriticalAppQueriesEnabled(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await expect(
        queryClient.fetchQuery({
          queryKey: queryKeys.dashboard,
          queryFn: async () => {
            throw new Error("dashboard unavailable");
          },
          retry: false,
        }),
      ).rejects.toThrow("dashboard unavailable");
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it.each(["/app/search", "/app/product/42", "/application", "/onboarding"])(
    "keeps noncritical work immediate on %s",
    (pathname) => {
      mockPathname.mockReturnValue(pathname);
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useNoncriticalAppQueriesEnabled(), {
        wrapper: Wrapper,
      });

      expect(result.current).toBe(true);
    },
  );
});
