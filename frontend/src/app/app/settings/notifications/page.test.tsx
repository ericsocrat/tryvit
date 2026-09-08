import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "./page";
const mocks = vi.hoisted(() => ({ get: vi.fn(), remove: vi.fn(), unsubscribe: vi.fn(), permission: vi.fn() }));
vi.mock("@/lib/push-manager", () => ({ isPushSupported: () => true, inspectCurrentPushSubscription: mocks.get, requestNotificationPermission: mocks.permission }));
vi.mock("@/lib/api", () => ({ deletePushSubscription: mocks.remove }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue(null); mocks.unsubscribe.mockResolvedValue(true); mocks.remove.mockResolvedValue({ ok: true, data: { success: true, deleted: true } }); });
const subscription = { endpoint: "https://push.example.test/fixture", unsubscribe: mocks.unsubscribe };
describe("paused notification settings", () => {
  it("explains retirement without creating permission, preference or subscription writes", async () => {
    render(<Page />);
    expect(await screen.findByText("Score-change alerts are paused")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enable/i })).not.toBeInTheDocument();
    expect(mocks.permission).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("provides recovery when subscription status cannot be read", async () => {
    mocks.get.mockRejectedValueOnce(new Error("offline"));
    render(<Page />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No successful removal has been confirmed");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
  it("removes only the existing browser subscription after explicit user action", async () => {
    mocks.get.mockResolvedValue(subscription); render(<Page />);
    await userEvent.click(await screen.findByRole("button", { name: "Remove this browser subscription" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Push notifications disabled");
    expect(mocks.remove).toHaveBeenCalledWith({}, subscription.endpoint);
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
  it.each([{ ok: false, error: { message: "offline" } }, { ok: true, data: { success: false, deleted: false } }])("fails closed on transport or application failure", async (response) => {
    mocks.get.mockResolvedValue(subscription); mocks.remove.mockResolvedValue(response);
    render(<Page />);
    await userEvent.click(await screen.findByRole("button", { name: "Remove this browser subscription" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove this browser subscription" })).toBeEnabled();
  });
  it("does not announce success when browser removal fails after backend deletion", async () => {
    mocks.get.mockResolvedValue(subscription); mocks.unsubscribe.mockResolvedValue(false);
    render(<Page />); await userEvent.click(await screen.findByRole("button", { name: "Remove this browser subscription" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
