import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HealthProfileSection } from "./HealthProfileSection";
import type { HealthProfile } from "@/lib/types";
import { showToast } from "@/lib/toast";
import { readFileSync } from "node:fs";
import path from "node:path";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/api", () => ({
  listHealthProfiles: mocks.list, createHealthProfile: mocks.create,
  updateHealthProfile: mocks.update, deleteHealthProfile: mocks.remove,
}));
vi.mock("@/lib/toast", () => ({ showToast: vi.fn() }));

function profile(overrides: Partial<HealthProfile> = {}): HealthProfile {
  return { profile_id: "p-1", profile_name: "Saved profile", is_active: true,
    health_conditions: ["diabetes"], max_sugar_g: 0, max_salt_g: 1.25,
    max_saturated_fat_g: null, max_calories_kcal: null, notes: "Synthetic saved note",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...overrides };
}
const listed = (profiles: HealthProfile[]) => ({ ok: true, data: { api_version: "1.0", profiles } });
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(<QueryClientProvider client={client}><HealthProfileSection /></QueryClientProvider>);
}
async function confirmDeletion() {
  await userEvent.click(await screen.findByRole("button", { name: "Delete Saved profile" }));
  await userEvent.click(screen.getByRole("button", { name: "Delete", exact: true }));
}
beforeEach(() => {
  vi.resetAllMocks();
  // jsdom lacks native dialog methods; real modal behavior is covered by the guarded browser test.
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  mocks.list.mockResolvedValue(listed([]));
});

describe("HealthProfileSection archive", () => {
  it.each(["en", "pl", "de"])("%s archive and privacy copy retain truthful current-purpose statements", (language) => {
    const messages = JSON.parse(readFileSync(path.resolve(`messages/${language}.json`), "utf8"));
    expect(messages.healthProfile.title).toMatch(/archive|archiwum|Archiv/);
    expect(messages.healthProfile.emptyState).not.toMatch(/Create|Utwórz|Erstellen/);
    expect(messages.healthProfile.archiveDescription).toBeTruthy();
    expect(messages.healthProfile.allergenPreferencesNotice).toBeTruthy();
    expect(messages.legal.howWeUseText).toMatch(/not used|nie służą|nicht für/);
    expect(messages.legal.howWeUseText).not.toMatch(/provide personalized food recommendations|dostarczania spersonalizowanych rekomendacji|personalisierte Lebensmittelempfehlungen/);
  });

  it("shows loading without creating or activating a profile", () => {
    mocks.list.mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("shows a truthful empty archive and separates allergen preferences", async () => {
    mount();
    await screen.findByText("No saved health profiles.");
    expect(screen.getByRole("heading", { name: "Saved health profiles (archive)" })).toBeInTheDocument();
    expect(screen.getByText(/not used for personal medical warnings/)).toBeInTheDocument();
    expect(screen.getByText(/separate allergen preferences still control matching/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Create one to get/)).not.toBeInTheDocument();
  });

  it("retains owned names, conditions, notes, zero limits and the historical flag as read-only data", async () => {
    mocks.list.mockResolvedValue(listed([profile()]));
    const { container } = mount();
    await userEvent.click(await screen.findByText("Saved profile"));
    expect(screen.getByText("Synthetic saved note")).toBeInTheDocument();
    expect(screen.getByText(/Previously stored active flag \(not applied\): Yes/)).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("1.25")).toBeInTheDocument();
    expect(container.querySelectorAll("input, textarea, select, form")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Delete Saved profile" })).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("distinguishes failed loading from an empty archive and retries the owner read", async () => {
    mocks.list.mockResolvedValueOnce({ ok: false, error: { message: "offline" } }).mockResolvedValueOnce(listed([profile()]));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Saved profiles could not be loaded");
    expect(screen.queryByText("No saved health profiles.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Saved profile");
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it("removes only the requested profile after confirmed owner deletion", async () => {
    mocks.list.mockResolvedValueOnce(listed([profile()])).mockResolvedValue(listed([]));
    mocks.remove.mockResolvedValue({ ok: true, data: { api_version: "1.0", profile_id: "p-1", deleted: true } });
    mount();
    await confirmDeletion();
    await screen.findByText("No saved health profiles.");
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({}, "p-1");
    expect(showToast).toHaveBeenCalledExactlyOnceWith({ type: "success", messageKey: "healthProfile.profileDeleted" });
  });

  it.each([
    { ok: false, error: { message: "offline" } },
    { ok: true, data: { profile_id: "p-1", deleted: false } },
    { ok: true, data: { profile_id: "another-profile", deleted: true } },
    { ok: true, data: { profile_id: "p-1" } },
  ])("keeps the profile and reports unconfirmed deletion for %j", async (result) => {
    mocks.list.mockResolvedValue(listed([profile()]));
    mocks.remove.mockResolvedValue(result);
    mount();
    await confirmDeletion();
    expect(await screen.findByRole("alert")).toHaveTextContent("Deletion was not confirmed");
    expect(screen.getByText("Saved profile")).toBeInTheDocument();
    expect(showToast).not.toHaveBeenCalled();
    expect(mocks.list).toHaveBeenCalledOnce();
  });

  it("handles a rejected deletion and allows retry", async () => {
    mocks.list.mockResolvedValue(listed([profile()]));
    mocks.remove.mockRejectedValue(new Error("transport"));
    mount();
    await confirmDeletion();
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Delete Saved profile" })).toBeEnabled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("prevents duplicate pending deletions", async () => {
    mocks.list.mockResolvedValue(listed([profile()]));
    mocks.remove.mockReturnValue(new Promise(() => {}));
    mount();
    const button = await screen.findByRole("button", { name: "Delete Saved profile" });
    await confirmDeletion();
    await waitFor(() => expect(button).toBeDisabled());
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("retains the saved record when deletion is cancelled", async () => {
    mocks.list.mockResolvedValue(listed([profile()]));
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Delete Saved profile" }));
    expect(screen.getByRole("dialog", { name: "Delete saved profile Saved profile?" })).toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Saved profile")).toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
