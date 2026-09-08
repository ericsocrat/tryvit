import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as CollectionsApi from "@/lib/evidence/collections";
import { fixtureListId, savedListFixture } from "@/lib/evidence/collections.fixtures";
import { translate } from "@/lib/i18n-core";
import ListDetailPage from "./page";

const mocks = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn(), update: vi.fn(), toggle: vi.fn(), revoke: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "aaaaaaaa-1111-4111-8111-111111111111" }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/evidence/collections", async (original) => ({ ...await original<typeof CollectionsApi>(), getSavedList: mocks.list }));
vi.mock("@/lib/api", () => ({ removeFromList: mocks.remove, updateList: mocks.update, toggleShare: mocks.toggle, revokeShare: mocks.revoke }));
vi.mock("@/hooks/use-analytics", () => ({ useAnalytics: () => ({ track: vi.fn() }) }));
vi.mock("@/lib/events", () => ({ eventBus: { emit: vi.fn() } }));

let data = savedListFixture();
beforeEach(() => {
  vi.clearAllMocks(); data = savedListFixture();
  mocks.list.mockImplementation(() => Promise.resolve({ ok: true, data }));
  mocks.remove.mockResolvedValue({ ok: true, data: { success: true } });
  mocks.update.mockResolvedValue({ ok: true, data: { success: true } });
  mocks.toggle.mockResolvedValue({ ok: true, data: { success: true } });
  mocks.revoke.mockResolvedValue({ ok: true, data: { success: true } });
});
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ListDetailPage /></QueryClientProvider>);
}

describe("evidence-first saved list", () => {
  it("preserves saved order, notes and archived identity without grades", async () => {
    mount(); await screen.findByRole("heading", { name: "Morning list" });
    const rows = screen.getAllByTestId("product-register-card");
    expect(rows[0]).toHaveTextContent("Fixture product 2");
    expect(rows[1]).toHaveTextContent("Fixture product 1");
    expect(screen.getByText("Morning note")).toBeInTheDocument();
    expect(screen.getByText("Archived product")).toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith({}, fixtureListId, 0, "en");
  });

  it("retains an unavailable product entry and its note, not an empty list", async () => {
    data.items[0].product = null;
    mount(); await screen.findByRole("heading", { name: "Morning list" });
    expect(screen.getByText("Product 2")).toBeInTheDocument();
    expect(screen.getByText("Morning note")).toBeInTheDocument();
    expect(screen.getByText(/This saved entry and its notes are retained/)).toBeInTheDocument();
    expect(screen.getAllByTestId("product-register-card")).toHaveLength(2);
  });

  it.each(["transport", "outer", "inner"] as const)("keeps rows and notes after %s removal failure", async (failure) => {
    if (failure === "transport") mocks.remove.mockRejectedValue(new Error("Offline"));
    if (failure === "outer") mocks.remove.mockResolvedValue({ ok: false, error: { message: "Denied" } });
    if (failure === "inner") mocks.remove.mockResolvedValue({ ok: true, data: { success: false } });
    mount(); await screen.findByRole("heading", { name: "Morning list" });
    fireEvent.click(screen.getByRole("button", { name: /Remove from list Fixture product 2/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(translate("en", "lists.mutationFailed"));
    expect(screen.getByText("Morning note")).toBeInTheDocument();
    expect(screen.getAllByTestId("product-register-card")).toHaveLength(2);
  });

  it("refreshes the same membership key only after successful removal", async () => {
    mocks.remove.mockImplementation(() => { data = { ...data, total_count: 1, items: data.items.slice(1) }; return Promise.resolve({ ok: true, data: { success: true } }); });
    mount(); await screen.findByRole("heading", { name: "Morning list" });
    fireEvent.click(screen.getByRole("button", { name: /Remove from list Fixture product 2/i }));
    await waitFor(() => expect(screen.getAllByTestId("product-register-card")).toHaveLength(1));
    expect(screen.getByText("Second note")).toBeInTheDocument();
  });

  it("keeps failed edits retryable and sends an explicit empty description", async () => {
    mocks.update.mockResolvedValue({ ok: true, data: { ok: false } });
    mount(); await screen.findByRole("heading", { name: "Morning list" });
    fireEvent.click(screen.getByRole("button", { name: translate("en", "lists.editList") }));
    const name = screen.getByRole("textbox", { name: translate("en", "lists.nameLabel") });
    fireEvent.change(name, { target: { value: "Edited name" } });
    fireEvent.change(screen.getByRole("textbox", { name: translate("en", "lists.descriptionLabel") }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");
    expect(name).toHaveValue("Edited name");
    expect(mocks.update).toHaveBeenCalledWith({}, fixtureListId, "Edited name", "");
  });

  it("keeps public sharing paused without changing existing share state", async () => {
    mount(); await screen.findByRole("heading", { name: "Morning list" });
    fireEvent.click(screen.getByRole("button", { name: translate("en", "lists.shareSettings") }));
    expect(screen.getByText(/Public sharing and exports are paused/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: translate("en", "lists.off") })).toBeDisabled();
    expect(mocks.toggle).not.toHaveBeenCalled();
  });

  it("provides pagination rather than silently stopping at the first page", async () => {
    data.total_count = 21;
    mount(); await screen.findByRole("heading", { name: "Morning list" });
    fireEvent.click(screen.getByRole("button", { name: translate("en", "common.next") }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({}, fixtureListId, 20, "en"));
  });

  it("keeps a read failure distinct from an empty list and offers retry", async () => {
    mocks.list.mockResolvedValueOnce({ ok: false, error: { message: "Unavailable" } });
    mount(); await screen.findByText(translate("en", "lists.loadListFailed"));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Morning list" })).toBeInTheDocument();
  });
});
