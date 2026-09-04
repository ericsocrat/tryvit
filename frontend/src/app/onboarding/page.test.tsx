import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OnboardingPage from "./page";

const { mockGetUser, mockPreferencesRpc, mockRedirect } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockPreferencesRpc: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockPreferencesRpc,
  })),
}));

vi.mock("@/lib/server-locale", () => ({
  getServerLocale: vi.fn(async () => "en"),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("./OnboardingWizard", () => ({
  OnboardingWizard: () => <div data-testid="onboarding-wizard" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRedirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mockPreferencesRpc.mockResolvedValue({
    data: { onboarding_complete: false },
    error: null,
  });
});

describe("OnboardingPage preference availability", () => {
  it("renders the wizard only after an explicit incomplete response", async () => {
    render(await OnboardingPage());
    expect(screen.getByTestId("onboarding-wizard")).toBeInTheDocument();
  });

  it("redirects an already-onboarded user", async () => {
    mockPreferencesRpc.mockResolvedValue({
      data: { onboarding_complete: true },
      error: null,
    });

    await expect(OnboardingPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/app/search");
  });

  it.each([
    {
      name: "transport error",
      response: { data: null, error: new Error("network unavailable") },
    },
    {
      name: "null response",
      response: { data: null, error: null },
    },
    {
      name: "business error",
      response: {
        data: { error: "Preferences unavailable" },
        error: null,
      },
    },
    {
      name: "malformed response",
      response: { data: {}, error: null },
    },
  ])("fails closed for a $name", async ({ response }) => {
    mockPreferencesRpc.mockResolvedValue(response);

    render(await OnboardingPage());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load your preferences",
    );
    expect(screen.queryByTestId("onboarding-wizard")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });

  it("redirects an unauthenticated visitor before reading preferences", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(OnboardingPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/auth/login");
    expect(mockPreferencesRpc).not.toHaveBeenCalled();
  });
});
