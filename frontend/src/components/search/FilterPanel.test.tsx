import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { FilterPanel } from "./FilterPanel";
import type { FindFilters } from "@/lib/evidence/search";
import type * as SearchApi from "@/lib/evidence/search";
import { auditComponentA11y } from "@/utils/test/a11y";

const mocks = vi.hoisted(() => ({ options: vi.fn(), changed: vi.fn() }));
vi.mock("@/lib/evidence/search", async (original) => ({ ...await original<typeof SearchApi>(), findFilterOptions: mocks.options }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.options.mockResolvedValue({ ok: true, data: { api_version: "2", country: "PL", language: "en", categories: [{ value: "Dairy", label: "Dairy" }] } });
});
function mount(initial: FindFilters = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Harness() {
    const [open, setOpen] = useState(false);
    const [filters, setFilters] = useState(initial);
    return <QueryClientProvider client={client}><button onClick={() => setOpen(true)}>Open filters</button><FilterPanel filters={filters} onChange={(next) => { mocks.changed(next); setFilters(next); }} show={open} onClose={() => setOpen(false)} country="PL" userId="fixture-user" /></QueryClientProvider>;
  }
  return render(<Harness />);
}

describe("accessible evidence-first filter disclosure", () => {
  it("does not render or fetch filters until explicitly opened", () => {
    const { container } = mount();
    expect(container.querySelector("dialog")).toBeNull();
    expect(mocks.options).not.toHaveBeenCalled();
  });

  it("opens a named modal and restores focus after Escape", async () => {
    mount();
    const trigger = screen.getByRole("button", { name: "Open filters" });
    trigger.focus(); fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Refine your search" });
    expect(dialog).toHaveAttribute("open");
    await screen.findByText("Dairy");
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("keeps Tab within the modal and provides a named close control", async () => {
    mount(); fireEvent.click(screen.getByText("Open filters")); await screen.findByText("Dairy");
    const last = screen.getByRole("button", { name: "Show Results" });
    last.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("offers source NOVA and contains exclusions, never legacy score filters", async () => {
    mount(); fireEvent.click(screen.getByText("Open filters")); await screen.findByText("Dairy");
    fireEvent.click(screen.getByRole("checkbox", { name: "NOVA 4" }));
    expect(mocks.changed).toHaveBeenLastCalledWith({ nova_group: ["4"] });
    fireEvent.click(screen.getByRole("checkbox", { name: "Milk" }));
    expect(mocks.changed).toHaveBeenLastCalledWith({ nova_group: ["4"], allergen_free: ["milk"] });
    expect(screen.getByText(/Remaining products are not established as allergen-free/)).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByText("Health Score")).not.toBeInTheDocument();
  });

  it("retains categories and loads market-scoped options", async () => {
    mount(); fireEvent.click(screen.getByText("Open filters")); await screen.findByText("Dairy");
    fireEvent.click(screen.getByRole("checkbox", { name: "Dairy" }));
    expect(mocks.changed).toHaveBeenLastCalledWith({ category: ["Dairy"] });
    expect(mocks.options).toHaveBeenCalledWith({}, "PL", "en");
  });

  it("makes unavailable category evidence retryable instead of silently empty", async () => {
    mocks.options.mockResolvedValueOnce({ ok: false, error: { message: "Unavailable" } });
    mount(); fireEvent.click(screen.getByText("Open filters"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Category choices couldn’t load");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Dairy")).toBeInTheDocument();
  });

  it("passes the component accessibility checks with the modal open", async () => {
    const { container } = mount(); fireEvent.click(screen.getByText("Open filters")); await screen.findByText("Dairy");
    const result = await auditComponentA11y(container);
    expect(result.violations).toEqual([]);
  });
});
