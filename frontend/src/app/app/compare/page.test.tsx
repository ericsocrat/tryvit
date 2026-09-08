import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { evidenceEnvelope, evidenceProduct, legacyProduct } from "@/components/evidence/product-evidence.fixtures";
import { useCompareStore } from "@/stores/compare-store";
import type * as EvidenceApi from "@/lib/evidence/api";
import ComparePage from "./page";
import { parseComparisonIds } from "@/lib/evidence/comparison-selection";

const state = vi.hoisted(() => ({ search: "ids=1,2" }));
const mocks = vi.hoisted(() => ({ read: vi.fn(), push: vi.fn(), save: vi.fn(), saveState: { isPending: false, isSuccess: false, isError: false } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.search), useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/evidence/api", async (importOriginal) => ({ ...await importOriginal<typeof EvidenceApi>(), getProductReadModels: mocks.read }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/hooks/use-compare", () => ({ useSaveComparison: () => ({ ...mocks.saveState, mutate: mocks.save }) }));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = () => <QueryClientProvider client={client}><ComparePage /></QueryClientProvider>;
  return { ...render(ui()), client, ui };
}
beforeEach(() => {
  state.search = "ids=1,2";
  vi.clearAllMocks();
  useCompareStore.getState().clear();
  Object.assign(mocks.saveState, { isPending: false, isSuccess: false, isError: false });
  mocks.read.mockImplementation((_client: unknown, ids: number[]) => Promise.resolve({ ok: true, data: evidenceEnvelope(ids.map((id) => evidenceProduct(id, { value: String(id) }))) }));
});

describe("comparison URL contract", () => {
  it.each(["-1,2", "1.5,2", "Infinity,2", "1,2,3,4,5", "1,,2", "1,9007199254740992", "01,2"])("rejects invalid selection %s without silently truncating", (value) => {
    expect(parseComparisonIds(value).invalid).toBe(true);
  });

  it("deduplicates valid IDs and preserves user-selected order", () => {
    expect(parseComparisonIds("2,1,2")).toEqual({ ids: [2, 1], invalid: false });
    expect(parseComparisonIds("")).toEqual({ ids: [], invalid: false });
  });

  it("does not fetch an empty or invalid comparison", () => {
    state.search = "";
    const { rerender, ui } = mount();
    expect(screen.getByRole("heading", { name: "Choose two to four different products" })).toBeInTheDocument();
    expect(mocks.read).not.toHaveBeenCalled();
    state.search = "ids=bad";
    rerender(ui());
    expect(screen.getByRole("alert")).toHaveTextContent("This comparison link is invalid");
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("keeps current in-memory selection reachable from an empty URL", () => {
    state.search = "";
    useCompareStore.getState().add(2, "Second");
    useCompareStore.getState().add(1, "First");
    mount();
    expect(screen.getByRole("link", { name: "Compare selected products" })).toHaveAttribute("href", "/app/compare?ids=2,1");
  });

  it("clears URL and selection together, and restores the URL-selected products on back", async () => {
    const { rerender, ui } = mount();
    await screen.findByRole("table");
    await waitFor(() => expect(useCompareStore.getState().getIds()).toEqual([1, 2]));
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(mocks.push).toHaveBeenCalledWith("/app/compare");
    expect(useCompareStore.getState().getIds()).toEqual([]);
    state.search = "";
    rerender(ui());
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    state.search = "ids=1,2";
    rerender(ui());
    await screen.findByRole("table");
    await waitFor(() => expect(useCompareStore.getState().getIds()).toEqual([1, 2]));
  });

  it("updates displayed products when a different same-length URL selection is opened", async () => {
    const { rerender, ui } = mount();
    await screen.findByRole("table");
    state.search = "ids=3,4";
    rerender(ui());
    await screen.findByRole("columnheader", { name: /Fixture product 3/ });
    expect(screen.queryByRole("columnheader", { name: /Fixture product 1/ })).not.toBeInTheDocument();
  });
});

describe("factual comparison", () => {
  it("announces loading and compares only neutral recorded values", async () => {
    let complete!: (value: unknown) => void;
    mocks.read.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("Loading comparison evidence");
    complete({ ok: true, data: evidenceEnvelope([evidenceProduct(1, { value: "2" }), evidenceProduct(2, { value: "1" })]) });
    const table = await screen.findByRole("table", { name: "Recorded nutrition comparison" });
    expect(within(table).getAllByText("Lower recorded value than the first product")).toHaveLength(9);
    expect(within(table).queryByText(/winner|healthier|score/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export|share/i })).not.toBeInTheDocument();
  });

  it("retains legacy values but withholds arithmetic and overall ranking", async () => {
    mocks.read.mockResolvedValue({ ok: true, data: evidenceEnvelope([legacyProduct(1), legacyProduct(2)]) });
    mount();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByText("Unverified legacy record")).toHaveLength(18);
    expect(within(table).getAllByText("Not compared: source evidence is unavailable")).toHaveLength(9);
    expect(within(table).queryByText("Per 100 g")).not.toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("withholds arithmetic when product-level evidence conflicts even if prior values were recorded", async () => {
    const product = evidenceProduct(2);
    product.evidence.state = "conflicting";
    mocks.read.mockResolvedValue({ ok: true, data: evidenceEnvelope([evidenceProduct(1), product]) });
    mount();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByText("Not compared: product evidence is conflicting")).toHaveLength(9);
  });

  it.each([
    [{ basis: "per_100ml" as const }, "Not compared: units, basis, serving size or preparation are not compatible"],
    [{ qualifier: "lt" as const }, "Not compared: values are not both exact"],
    [{ preparation_state: "prepared" as const }, "Not compared: units, basis, serving size or preparation are not compatible"],
  ])("explains incompatible or qualified values %j", async (change, explanation) => {
    mocks.read.mockResolvedValue({ ok: true, data: evidenceEnvelope([evidenceProduct(1), evidenceProduct(2, change)]) });
    mount();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByText(explanation)).toHaveLength(9);
  });

  it("retains product warnings without inferring allergen absence", async () => {
    const product = legacyProduct(2);
    product.allergens = { state: "unverified", contains: [{ name: "en:milk", state: "unverified", observation_id: null }], traces: [] };
    mocks.read.mockResolvedValue({ ok: true, data: evidenceEnvelope([legacyProduct(1), product]) });
    mount();
    await screen.findByRole("table");
    expect(screen.getByText("Milk")).toBeInTheDocument();
    expect(screen.getByText(/Allergen absence has not been assessed/)).toBeInTheDocument();
  });

  it("reports missing selected IDs and does not compare a single returned product", async () => {
    mocks.read.mockResolvedValue({ ok: true, data: evidenceEnvelope([evidenceProduct(1)], [2]) });
    mount();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Unavailable selected products: 1"));
    expect(screen.getByRole("heading", { name: "Not enough available products to compare" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("returns to valid evidence through retry after a failed request", async () => {
    mocks.read.mockResolvedValueOnce({ ok: false, error: { message: "Unavailable" } });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Comparison information couldn’t load");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("saves only displayed product IDs and keeps selection after a failed save", async () => {
    const { rerender, ui } = mount();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Save Comparison" }));
    expect(mocks.save).toHaveBeenCalledWith({ productIds: [1, 2] });
    mocks.saveState.isError = true;
    rerender(ui());
    expect(screen.getByRole("alert")).toHaveTextContent("The comparison wasn’t saved");
    expect(useCompareStore.getState().getIds()).toEqual([1, 2]);
    expect(screen.queryByText("Comparison saved")).not.toBeInTheDocument();
  });
});
