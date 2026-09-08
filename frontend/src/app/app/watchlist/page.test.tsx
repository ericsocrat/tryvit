import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as CollectionsApi from "@/lib/evidence/collections";
import { watchedFixture } from "@/lib/evidence/collections.fixtures";
import { translate } from "@/lib/i18n-core";
import WatchlistPage from "./page";

const mocks = vi.hoisted(() => ({ read: vi.fn(), unwatch: vi.fn() }));
vi.mock("@/lib/evidence/collections", async (original) => ({ ...await original<typeof CollectionsApi>(), getWatchedProducts: mocks.read }));
vi.mock("@/lib/api", () => ({ unwatchProduct: mocks.unwatch }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
let data = watchedFixture();
beforeEach(() => {
  vi.clearAllMocks(); data = watchedFixture();
  mocks.read.mockImplementation(() => Promise.resolve({ ok: true, data }));
  mocks.unwatch.mockResolvedValue({ ok: true, data: { success: true, watching: false } });
});
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><WatchlistPage /></QueryClientProvider>);
}

describe("watched product evidence", () => {
  it("keeps timestamps, archive state and product identity, without score trends", async () => {
    mount();
    expect(await screen.findByRole("link", { name: /Fixture product 1/ })).toHaveAttribute("href", "/app/product/1");
    expect(screen.getByText("Archived product")).toBeInTheDocument();
    expect(screen.getByText(/Watching since Jan 1, 2025/)).toBeInTheDocument();
    expect(screen.getByText(/Legacy score-change monitoring is paused/)).toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByText(/Stable|Improving|Worsening/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("score-trend")).not.toBeInTheDocument();
  });

  it("distinguishes empty membership from unavailable source data", async () => {
    data.items[0].product = null;
    mount();
    expect(await screen.findByText("Product 1")).toBeInTheDocument();
    expect(screen.getByText(/This saved entry and its notes are retained/)).toBeInTheDocument();
    expect(screen.queryByText("No watched products")).not.toBeInTheDocument();
  });

  it.each(["transport", "outer", "inner", "still_watching"] as const)("preserves the row after %s unwatch failure", async (failure) => {
    if (failure === "transport") mocks.unwatch.mockRejectedValue(new Error("Offline"));
    if (failure === "outer") mocks.unwatch.mockResolvedValue({ ok: false, error: { message: "Denied" } });
    if (failure === "inner") mocks.unwatch.mockResolvedValue({ ok: true, data: { success: false } });
    if (failure === "still_watching") mocks.unwatch.mockResolvedValue({ ok: true, data: { success: true, watching: true } });
    mount(); await screen.findByText("Fixture product 1");
    fireEvent.click(screen.getByRole("button", { name: `${translate("en", "watchlist.unwatchButton")} Fixture product 1` }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your watchlist is unchanged");
    expect(screen.getByText("Fixture product 1")).toBeInTheDocument();
  });

  it("refreshes all paged membership after confirmed removal", async () => {
    mocks.unwatch.mockImplementation(() => { data = { ...data, items: [], total: 0 }; return Promise.resolve({ ok: true, data: { success: true, watching: false } }); });
    mount(); await screen.findByText("Fixture product 1");
    fireEvent.click(screen.getByRole("button", { name: `${translate("en", "watchlist.unwatchButton")} Fixture product 1` }));
    expect(await screen.findByText("No watched products")).toBeInTheDocument();
    expect(screen.queryByText("Fixture product 1")).not.toBeInTheDocument();
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });

  it("recovers from a load error without a false empty-state result", async () => {
    mocks.read.mockResolvedValueOnce({ ok: false, error: { message: "Unavailable" } });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(translate("en", "watchlist.loadError"));
    expect(screen.queryByText("No watched products")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Fixture product 1")).toBeInTheDocument();
  });

  it("pages without reordering or inventing saved products", async () => {
    data.total = 21; data.total_pages = 2;
    mount(); await screen.findByText("Fixture product 1");
    fireEvent.click(screen.getByRole("button", { name: translate("en", "common.next") }));
    await waitFor(() => expect(mocks.read).toHaveBeenLastCalledWith({}, 2, "en"));
  });
});
