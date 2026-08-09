import { queryKeys } from "@/lib/query-keys";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNoncriticalAppQueriesEnabled } from "./use-noncritical-app-queries";

const mockPathname = vi.fn<() => string>();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

let nextAnimationFrameId = 1;
let animationFrameCallbacks = new Map<number, FrameRequestCallback>();

function flushAnimationFrame() {
  const callbacks = [...animationFrameCallbacks.entries()];
  for (const [id] of callbacks) animationFrameCallbacks.delete(id);
  for (const [, callback] of callbacks) callback(performance.now());
}

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
    nextAnimationFrameId = 1;
    animationFrameCallbacks = new Map();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const id = nextAnimationFrameId++;
        animationFrameCallbacks.set(id, callback);
        return id;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id: number) => {
        animationFrameCallbacks.delete(id);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defers noncritical work on exact /app while the dashboard is pending", () => {
    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useNoncriticalAppQueriesEnabled(), {
      wrapper: Wrapper,
    });

    expect(result.current).toBe(false);
    expect(queryClient.getQueryState(queryKeys.dashboard)).toBeUndefined();
  });

  it("releases noncritical work two animation frames after dashboard success", async () => {
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

    await waitFor(() => expect(requestAnimationFrame).toHaveBeenCalledOnce());
    expect(result.current).toBe(false);
    expect(dashboardFetch).toHaveBeenCalledOnce();

    act(flushAnimationFrame);
    expect(result.current).toBe(false);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);

    act(flushAnimationFrame);
    expect(result.current).toBe(true);
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

    await waitFor(() => expect(requestAnimationFrame).toHaveBeenCalledOnce());
    act(flushAnimationFrame);
    act(flushAnimationFrame);
    expect(result.current).toBe(true);
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    });

    await waitFor(() => expect(dashboardFetch).toHaveBeenCalledTimes(2));
    expect(result.current).toBe(true);
  });

  it("releases noncritical work two animation frames after dashboard error", async () => {
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

    await waitFor(() => expect(requestAnimationFrame).toHaveBeenCalledOnce());
    expect(result.current).toBe(false);
    act(flushAnimationFrame);
    expect(result.current).toBe(false);
    act(flushAnimationFrame);
    expect(result.current).toBe(true);
  });

  it("does not mutate or fetch an already-settled dashboard query", async () => {
    const { queryClient, Wrapper } = createWrapper();
    const dashboard = { recently_viewed: [], stats: { total_viewed: 0 } };
    queryClient.setQueryData(queryKeys.dashboard, dashboard);
    const fetchQuery = vi.spyOn(queryClient, "fetchQuery");
    const setQueryData = vi.spyOn(queryClient, "setQueryData");
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useNoncriticalAppQueriesEnabled(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(requestAnimationFrame).toHaveBeenCalledOnce());
    act(flushAnimationFrame);
    act(flushAnimationFrame);

    expect(result.current).toBe(true);
    expect(queryClient.getQueryData(queryKeys.dashboard)).toBe(dashboard);
    expect(fetchQuery).not.toHaveBeenCalled();
    expect(setQueryData).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("cancels a pending post-paint release when unmounted", async () => {
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(queryKeys.dashboard, { recently_viewed: [] });
    const { unmount } = renderHook(() => useNoncriticalAppQueriesEnabled(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(requestAnimationFrame).toHaveBeenCalledOnce());
    act(flushAnimationFrame);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(2);
    expect(animationFrameCallbacks).toHaveLength(0);
  });

  it("requires a fresh post-paint release after the dashboard query is removed", async () => {
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(queryKeys.dashboard, { recently_viewed: [] });
    const { result, rerender } = renderHook(
      () => useNoncriticalAppQueriesEnabled(),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(requestAnimationFrame).toHaveBeenCalledOnce());
    act(flushAnimationFrame);
    act(flushAnimationFrame);
    expect(result.current).toBe(true);

    mockPathname.mockReturnValue("/app/search");
    rerender();
    act(() => queryClient.removeQueries({ queryKey: queryKeys.dashboard }));
    expect(result.current).toBe(true);

    mockPathname.mockReturnValue("/app");
    rerender();
    expect(result.current).toBe(false);

    act(() => {
      queryClient.setQueryData(queryKeys.dashboard, { recently_viewed: [] });
    });
    await waitFor(() => expect(requestAnimationFrame).toHaveBeenCalledTimes(3));
    act(flushAnimationFrame);
    expect(result.current).toBe(false);
    act(flushAnimationFrame);
    expect(result.current).toBe(true);
  });

  it("cancels and rearms the post-paint release across mid-frame navigation", async () => {
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(queryKeys.dashboard, { recently_viewed: [] });
    const { result, rerender } = renderHook(
      () => useNoncriticalAppQueriesEnabled(),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(requestAnimationFrame).toHaveBeenCalledOnce());
    act(flushAnimationFrame);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);

    mockPathname.mockReturnValue("/app/product/42");
    rerender();
    expect(result.current).toBe(true);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(2);
    expect(animationFrameCallbacks).toHaveLength(0);

    mockPathname.mockReturnValue("/app");
    rerender();
    await waitFor(() => expect(requestAnimationFrame).toHaveBeenCalledTimes(3));
    expect(result.current).toBe(false);
    act(flushAnimationFrame);
    expect(result.current).toBe(false);
    act(flushAnimationFrame);
    expect(result.current).toBe(true);
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
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    },
  );
});
