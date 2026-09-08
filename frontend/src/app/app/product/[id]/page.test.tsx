import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { evidenceEnvelope, evidenceProduct, legacyProduct } from "@/components/evidence/product-evidence.fixtures";
import * as evidenceApi from "@/lib/evidence/api";
import { useCompareStore } from "@/stores/compare-store";
import { translate } from "@/lib/i18n-core";
import ProductDetailPage from "./page";

const state = vi.hoisted(() => ({ id: "1", language: "en" as "en" | "pl" | "de", qaMode: false }));
const mocks = vi.hoisted(() => ({ read: vi.fn(), record: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: state.id }) }));
vi.mock("@/lib/evidence/api", async (importOriginal) => ({ ...await importOriginal<typeof evidenceApi>(), getProductReadModels: mocks.read }));
vi.mock("@/lib/api", () => ({ recordProductView: mocks.record }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/qa-mode", () => ({ get IS_QA_MODE() { return state.qaMode; } }));
vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ language: state.language, t: (key: string, values?: Record<string, string | number>) => translate(state.language, key, values) }) }));
vi.mock("@/components/product/AddToListMenu", () => ({ AddToListMenu: ({ productId }: { productId: number }) => <button data-product-id={productId}>Save to list</button> }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- forwarded test image
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(<QueryClientProvider client={client}><ProductDetailPage /></QueryClientProvider>);
  return { ...result, client };
}
beforeEach(() => {
  state.id = "1"; state.language = "en";
  state.qaMode = false;
  vi.clearAllMocks();
  useCompareStore.getState().clear();
  mocks.read.mockResolvedValue({ ok: true, data: evidenceEnvelope([evidenceProduct()]) });
  mocks.record.mockResolvedValue({ ok: true, data: {} });
});

describe("evidence-first product detail", () => {
  it("announces loading, then renders the requested identity from the v2 contract", async () => {
    let complete!: (value: unknown) => void;
    mocks.read.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("Loading product evidence");
    expect(mocks.record).not.toHaveBeenCalled();
    complete({ ok: true, data: evidenceEnvelope([evidenceProduct()]) });
    expect(await screen.findByRole("heading", { level: 1, name: "Fixture product 1" })).toBeInTheDocument();
    expect(mocks.read).toHaveBeenCalledWith({}, [1], "en");
    expect(screen.getByRole("button", { name: "Save to list" })).toHaveAttribute("data-product-id", "1");
  });

  it.each(["abc", "-1", "1.5", "0", "9007199254740992"])("does not request an invalid product ID %s", (id) => {
    state.id = id;
    mount();
    expect(screen.getByRole("heading", { name: "Product not found" })).toBeInTheDocument();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("uses missing_ids as a truthful not-found state", async () => {
    mocks.read.mockResolvedValue({ ok: true, data: evidenceEnvelope([], [1]) });
    mount();
    expect(await screen.findByRole("heading", { name: "Product not found" })).toBeInTheDocument();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("does not substitute another returned product for the requested ID", async () => {
    mocks.read.mockResolvedValue({ ok: true, data: evidenceEnvelope([evidenceProduct(2)], [1]) });
    mount();
    expect(await screen.findByRole("heading", { name: "Product not found" })).toBeInTheDocument();
    expect(screen.queryByText("Fixture product 2")).not.toBeInTheDocument();
  });

  it("shows contract/transport failure with retry, never a positive result", async () => {
    mocks.read.mockResolvedValueOnce({ ok: false, error: { message: "Invalid evidence contract" } });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Product information couldn’t load");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Fixture product 1" })).toBeInTheDocument();
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });

  it("preserves legacy values as unverified with unknown basis, without scores or safety claims", async () => {
    mocks.read.mockResolvedValue({ ok: true, data: evidenceEnvelope([legacyProduct()]) });
    mount();
    await screen.findByRole("heading", { name: "Fixture product 1" });
    expect(screen.getAllByText(/Unverified legacy record/)).toHaveLength(1);
    expect(screen.getAllByText(/Basis not recorded/)).toHaveLength(1);
    expect(screen.getByText("For values shown")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-evidence-state="unverified"]')).toHaveLength(9);
    expect(screen.queryByText(/Per 100 g/)).not.toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByText(/TryVit score|\/100|research.grade|harm potential/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Allergen absence has not been assessed/)).toBeInTheDocument();
  });

  it("retains comparison selection and the exact product link", async () => {
    mount();
    await screen.findByRole("heading", { name: "Fixture product 1" });
    fireEvent.click(screen.getByRole("button", { name: "Compare: Add to comparison" }));
    expect(useCompareStore.getState().getIds()).toEqual([1]);
    expect(screen.queryByRole("link", { name: "Open comparison" })).not.toBeInTheDocument();
    act(() => useCompareStore.getState().add(2, "Second fixture"));
    expect(screen.getByRole("link", { name: "Open comparison" })).toHaveAttribute("href", "/app/compare?ids=1,2");
  });

  it("records a cold view once after successful load, not again on a refresh", async () => {
    const { client } = mount();
    await screen.findByRole("heading", { name: "Fixture product 1" });
    await waitFor(() => expect(mocks.record).toHaveBeenCalledTimes(1));
    await act(async () => { await client.invalidateQueries({ queryKey: evidenceApi.evidenceQueryKeys.products([1], "en") }); });
    expect(mocks.record).toHaveBeenCalledTimes(1);
  });

  it("does not record product views in deterministic QA fixtures", async () => {
    state.qaMode = true;
    const { client } = mount();
    await screen.findByRole("heading", { name: "Fixture product 1" });
    await act(async () => { await client.invalidateQueries({ queryKey: evidenceApi.evidenceQueryKeys.products([1], "en") }); });
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it.each(["en", "pl", "de"] as const)("renders translated evidence controls in %s", async (language) => {
    state.language = language;
    mount();
    await screen.findByRole("heading", { name: "Fixture product 1" });
    expect(screen.getByRole("heading", { name: translate(language, "evidenceUi.nutritionTitle") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: translate(language, "evidenceUi.allergensTitle") })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("evidenceUi.");
  });
});
