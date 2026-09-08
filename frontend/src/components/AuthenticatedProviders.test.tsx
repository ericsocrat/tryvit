import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedProviders } from "@/components/AuthenticatedProviders";
import { useAdminStore } from "@/stores/admin-store";
import { useAvoidStore } from "@/stores/avoid-store";
import { useCompareStore } from "@/stores/compare-store";
import { useFavoritesStore } from "@/stores/favorites-store";

type Listener = (event: string, session: { user: { id: string } } | null) => void;
const mocks = vi.hoisted(() => ({
  initAchievements: vi.fn(() => vi.fn()), reportWebVitals: vi.fn(),
  router: { refresh: vi.fn(), replace: vi.fn() }, unsubscribe: vi.fn(),
  identity: "A" as string | null, listeners: new Set<Listener>(),
}));
vi.mock("@/lib/events", () => ({ initAchievementMiddleware: mocks.initAchievements }));
vi.mock("@/lib/web-vitals", () => ({ reportWebVitals: mocks.reportWebVitals }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ t: () => "Loading" }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  onAuthStateChange: (listener: Listener) => {
    mocks.listeners.add(listener);
    listener("INITIAL_SESSION", mocks.identity ? { user: { id: mocks.identity } } : null);
    return { data: { subscription: { unsubscribe: () => {
      mocks.listeners.delete(listener); mocks.unsubscribe();
    } } } };
  },
} }) }));

let clients: QueryClient[];
function Probe({ account = "A" }: Readonly<{ account?: string }>) {
  const client = useQueryClient();
  const { data } = useQuery<string>({ queryKey: ["private-account"], queryFn: async () => "unused", enabled: false });
  useEffect(() => { clients.push(client); }, [client]);
  return <p>{account}: {data ?? "empty"}</p>;
}
function emit(event: string, id: string | null) {
  mocks.identity = id;
  for (const listener of mocks.listeners) listener(event, id ? { user: { id } } : null);
}
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); mocks.identity = "A"; mocks.listeners.clear(); clients = []; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("AuthenticatedProviders", () => {
  it("does not retain private query data when the server-verified identity changes", () => {
    const { rerender } = render(<AuthenticatedProviders userId="A"><Probe /></AuthenticatedProviders>);
    const oldClient = clients[0];
    act(() => { oldClient.setQueryData(["private-account"], "private A value"); });
    mocks.identity = "B";
    rerender(<AuthenticatedProviders userId="B"><Probe account="B" /></AuthenticatedProviders>);
    expect(screen.queryByText(/private A value/)).not.toBeInTheDocument();
    expect(screen.getByText("B: empty")).toBeInTheDocument();
    expect(clients.at(-1)).not.toBe(oldClient);
    expect(oldClient.getQueryCache().getAll()).toHaveLength(0);
  });
  it("holds private children until browser identity matches the server gate", () => {
    mocks.identity = "B";
    render(<AuthenticatedProviders userId="A"><Probe /></AuthenticatedProviders>);
    expect(screen.queryByText("A: empty")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });
  it("synchronously conceals and clears account changes, deferring router work", () => {
    vi.useFakeTimers();
    render(<AuthenticatedProviders userId="A"><Probe /></AuthenticatedProviders>);
    const client = clients[0];
    const container = screen.getByText("A: empty").parentElement;
    act(() => { client.setQueryData(["private-account"], "private A value"); });
    act(() => {
      emit("SIGNED_IN", "B");
      expect(container).toHaveStyle({ display: "none" });
      expect(client.getQueryData(["private-account"])).toBeUndefined();
      expect(mocks.router.refresh).not.toHaveBeenCalled();
    });
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
    act(() => { vi.runOnlyPendingTimers(); });
    expect(mocks.router.refresh).toHaveBeenCalledOnce();
  });
  it("clears private stores on signout while preserving device preferences", () => {
    vi.useFakeTimers();
    render(<AuthenticatedProviders userId="A"><Probe /></AuthenticatedProviders>);
    useCompareStore.getState().add(1, "private selection");
    useAvoidStore.getState().setAvoidedIds([2]);
    useFavoritesStore.getState().setFavoriteIds([3]);
    useAdminStore.getState().setIsAdmin(true);
    localStorage.setItem("theme", "dark");
    localStorage.setItem("device-preference", "keep");
    act(() => { emit("SIGNED_OUT", null); });
    expect(useCompareStore.getState().getIds()).toEqual([]);
    expect(useAvoidStore.getState().avoidedIds.size).toBe(0);
    expect(useFavoritesStore.getState().favoriteIds.size).toBe(0);
    expect(useAdminStore.getState().isAdmin).toBe(false);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(localStorage.getItem("device-preference")).toBe("keep");
    expect(mocks.router.replace).not.toHaveBeenCalled();
    act(() => { vi.runOnlyPendingTimers(); });
    expect(mocks.router.replace).toHaveBeenCalledWith("/auth/login");
  });
  it("cannot repopulate either account cache when an old query ignores cancellation", async () => {
    const { rerender } = render(<AuthenticatedProviders userId="A"><Probe /></AuthenticatedProviders>);
    const oldClient = clients[0];
    let resolve!: (value: string) => void;
    const response = new Promise<string>(done => { resolve = done; });
    const pending = oldClient.fetchQuery({ queryKey: ["late-private"], queryFn: () => response }).catch(() => undefined);
    act(() => { emit("SIGNED_IN", "B"); });
    rerender(<AuthenticatedProviders userId="B"><Probe account="B" /></AuthenticatedProviders>);
    await act(async () => { resolve("private A late response"); await pending; });
    expect(oldClient.getQueryData(["late-private"])).toBeUndefined();
    expect(clients.at(-1)?.getQueryData(["late-private"])).toBeUndefined();
    expect(screen.getByText("B: empty")).toBeInTheDocument();
  });
  it("preserves cached data on same-user token refresh", () => {
    render(<AuthenticatedProviders userId="A"><Probe /></AuthenticatedProviders>);
    const client = clients[0];
    useFavoritesStore.getState().setFavoriteIds([7]);
    act(() => { client.setQueryData(["private-account"], "own cached value"); emit("TOKEN_REFRESHED", "A"); });
    expect(clients[0]).toBe(client);
    expect(client.getQueryData(["private-account"])).toBe("own cached value");
    expect(useFavoritesStore.getState().favoriteIds.has(7)).toBe(true);
    expect(mocks.router.refresh).not.toHaveBeenCalled();
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });
  it("unsubscribes and cancels deferred navigation on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = render(<AuthenticatedProviders userId="A"><Probe /></AuthenticatedProviders>);
    act(() => { emit("SIGNED_IN", "B"); });
    unmount();
    act(() => { vi.runOnlyPendingTimers(); });
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    expect(mocks.listeners.size).toBe(0);
    expect(mocks.router.refresh).not.toHaveBeenCalled();
    expect(clients[0].getQueryCache().getAll()).toHaveLength(0);
  });
  it("retains app-only achievements and configured telemetry", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.invalid/1");
    render(<AuthenticatedProviders userId="A"><p>Authenticated application</p></AuthenticatedProviders>);
    expect(screen.getByText("Authenticated application")).toBeInTheDocument();
    expect(mocks.initAchievements).toHaveBeenCalledOnce();
    await waitFor(() => { expect(mocks.reportWebVitals).toHaveBeenCalledOnce(); });
  });
  it("does not load web-vitals telemetry when the public DSN is blank", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    render(<AuthenticatedProviders userId="A"><p>Authenticated application</p></AuthenticatedProviders>);
    await vi.dynamicImportSettled();
    expect(mocks.initAchievements).toHaveBeenCalledOnce();
    expect(mocks.reportWebVitals).not.toHaveBeenCalled();
  });
});
