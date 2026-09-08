import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as SearchApi from "@/lib/evidence/search";
import type { FindEnvelope, FindRequest } from "@/lib/evidence/search";
import type { UserPreferences } from "@/lib/types";
import { findPreferencesFixture } from "@/lib/evidence/search.fixtures";
import { legacyProduct } from "@/components/evidence/product-evidence.fixtures";
import { useAvoidStore } from "@/stores/avoid-store";
import { useCompareStore } from "@/stores/compare-store";
import SearchPage from "./page";

const nav = vi.hoisted(() => ({ search: "q=milk", push: vi.fn(), replace: vi.fn(), refresh: undefined as (() => void) | undefined }));
const mocks = vi.hoisted(() => ({ find: vi.fn(), options: vi.fn(), preferences: { data: undefined as UserPreferences | undefined, error: null as Error | null, isPending: false, refetch: vi.fn() } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.search), useRouter: () => nav }));
vi.mock("@/lib/evidence/search", async (original) => ({ ...await original<typeof SearchApi>(), findProducts: mocks.find, findFilterOptions: mocks.options }));
vi.mock("@/hooks/use-user-preferences-query", () => ({ useUserPreferencesQuery: () => mocks.preferences }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/components/product/AddToListMenu", () => ({ AddToListMenu: ({ productId }: { productId: number }) => <button data-product-id={productId}>Save to list</button> }));
vi.mock("@/components/search/SaveSearchDialog", () => ({ SaveSearchDialog: () => <div role="dialog">Save search</div> }));

function result(request: FindRequest): FindEnvelope {
  return { api_version: "2", policy_version: "evidence-first-v1", query: request.q, country: "PL", language: "en", total: 1, page: request.page, pages: 1, page_size: 20, filters_applied: request.filters, preferences_applied: false, results: [legacyProduct()] };
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = () => <QueryClientProvider client={client}><SearchPage /></QueryClientProvider>;
  const rendered = render(ui());
  nav.refresh = () => rendered.rerender(ui());
  return rendered;
}
beforeEach(() => {
  vi.clearAllMocks(); nav.search = "q=milk"; nav.refresh = undefined;
  mocks.preferences.data = { ...findPreferencesFixture }; mocks.preferences.error = null; mocks.preferences.isPending = false;
  useAvoidStore.getState().reset(); useCompareStore.getState().clear();
  const navigate = (href: string) => { nav.search = new URL(href, "https://example.org").search; nav.refresh?.(); };
  nav.push.mockImplementation(navigate); nav.replace.mockImplementation(navigate);
  mocks.find.mockImplementation((_client: unknown, request: FindRequest) => Promise.resolve({ ok: true, data: result(request) }));
  mocks.options.mockResolvedValue({ ok: true, data: { api_version: "2", country: "PL", language: "en", categories: [{ value: "Dairy", label: "Dairy" }] } });
});

describe("evidence-first Find", () => {
  it("executes the URL query and preserves product identity, save and comparison actions", async () => {
    mount();
    const link = await screen.findByRole("link", { name: /Fixture product 1/ });
    expect(link).toHaveAttribute("href", "/app/product/1");
    expect(mocks.find).toHaveBeenCalledWith({}, expect.objectContaining({ q: "milk", page: 1 }), "en", "PL");
    expect(screen.getByRole("searchbox")).toHaveValue("milk");
    expect(screen.getByRole("button", { name: "Save to list" })).toHaveAttribute("data-product-id", "1");
    fireEvent.click(screen.getByRole("button", { name: "Add to comparison" }));
    expect(useCompareStore.getState().getIds()).toEqual([1]);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByText("/100")).not.toBeInTheDocument();
  });

  it("has one quiet starting point and no unrequested filter/catalog fetch", () => {
    nav.search = ""; mount();
    expect(screen.getByRole("heading", { name: "Start with something on your label" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.options).not.toHaveBeenCalled();
    expect(screen.queryByText("Popular searches")).not.toBeInTheDocument();
  });

  it("pushes an explicit search and resets pagination while retaining supported filters", async () => {
    nav.search = "q=milk&category=Dairy&page=2";
    mount(); await screen.findByRole("link", { name: /Fixture product 1/ });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "skyr" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(nav.push).toHaveBeenCalledWith("/app/search?q=skyr&category=Dairy", { scroll: false });
    await waitFor(() => expect(mocks.find).toHaveBeenLastCalledWith({}, expect.objectContaining({ q: "skyr", page: 1, filters: { category: ["Dairy"] } }), "en", "PL"));
  });

  it("replaces rather than pushes history for debounced editing", async () => {
    mount(); await screen.findByRole("link", { name: /Fixture product 1/ });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "yogurt" } });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/app/search?q=yogurt", { scroll: false }));
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.getByRole("searchbox")).toHaveValue("yogurt");
  });

  it("reflects browser back/forward changes rather than a stale submitted query", async () => {
    mount(); await screen.findByRole("link", { name: /Fixture product 1/ });
    act(() => { nav.search = "q=skyr&nova_group=4"; nav.refresh?.(); });
    expect(screen.getByRole("searchbox")).toHaveValue("skyr");
    await waitFor(() => expect(mocks.find).toHaveBeenLastCalledWith({}, expect.objectContaining({ q: "skyr", filters: { nova_group: ["4"] } }), "en", "PL"));
  });

  it("does not silently execute legacy score filters and preserves the query during explicit recovery", async () => {
    nav.search = new URLSearchParams({ q: "skyr", filters: JSON.stringify({ max_unhealthiness: 20, category: ["Dairy"] }) }).toString();
    mount();
    expect(screen.getByRole("alert")).toHaveTextContent("They have not been applied");
    expect(mocks.find).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use supported settings" }));
    await screen.findByRole("link", { name: /Fixture product 1/ });
    expect(nav.search).toContain("q=skyr");
    expect(nav.search).toContain("category=Dairy");
    expect(nav.search).not.toContain("max_unhealthiness");
  });

  it("fails closed when preference context cannot load", () => {
    mocks.preferences.data = undefined; mocks.preferences.error = new Error("Unavailable");
    mount();
    expect(screen.getByRole("alert")).toHaveTextContent("rather than guessing your market");
    expect(mocks.find).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.preferences.refetch).toHaveBeenCalled();
  });

  it("does not silently discard retired settings when opening controls or editing the query", async () => {
    nav.search = new URLSearchParams({ q: "skyr", filters: JSON.stringify({ max_unhealthiness: 20 }) }).toString();
    mount();
    expect(screen.getByRole("button", { name: "Filters (0)" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Order" })).toBeDisabled();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "milk" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(nav.search).toContain("max_unhealthiness");
    expect(mocks.find).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use supported settings" }));
    await screen.findByRole("link", { name: /Fixture product 1/ });
    expect(nav.search).not.toContain("max_unhealthiness");
  });

  it("shows no eligible matches, not a safe product or an empty-catalog claim", async () => {
    mocks.find.mockImplementation((_client: unknown, request: FindRequest) => Promise.resolve({ ok: true, data: { ...result(request), total: 0, results: [], preferences_applied: true } }));
    mount();
    expect(await screen.findByRole("heading", { name: "No eligible matches for this search" })).toBeInTheDocument();
    expect(screen.getByText(/does not mean the catalog is empty/)).toBeInTheDocument();
  });

  it("shows and recovers a failed request without turning it into zero results", async () => {
    mocks.find.mockResolvedValueOnce({ ok: false, error: { message: "Unavailable" } });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Search couldn’t load");
    expect(screen.queryByText("Matching products: 0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: /Fixture product 1/ })).toBeInTheDocument();
  });

  it("opens collapsed filters from the category URL and updates selected NOVA", async () => {
    nav.search = "q=milk&panel=categories"; mount();
    const dialog = screen.getByRole("dialog", { name: "Refine your search" });
    await screen.findByText("Dairy");
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "NOVA 4" }));
    await waitFor(() => expect(mocks.find).toHaveBeenLastCalledWith({}, expect.objectContaining({ filters: { nova_group: ["4"] } }), "en", "PL"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(nav.search).not.toContain("panel");
  });

  it("refetches when context and the avoided set change", async () => {
    mount(); await screen.findByRole("link", { name: /Fixture product 1/ });
    const original = mocks.find.mock.calls.length;
    act(() => { useAvoidStore.getState().addAvoided(1); });
    await waitFor(() => expect(mocks.find.mock.calls.length).toBeGreaterThan(original));
    act(() => { mocks.preferences.data = { ...findPreferencesFixture, country: "DE", updated_at: "2026-09-02" }; nav.refresh?.(); });
    await waitFor(() => expect(mocks.find).toHaveBeenLastCalledWith({}, expect.anything(), "en", "DE"));
  });
});
