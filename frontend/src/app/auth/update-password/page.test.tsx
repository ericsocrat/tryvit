import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UpdatePasswordPage from "./page";

const { mockGetUser, mockRedirect } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("./UpdatePasswordForm", () => ({
  UpdatePasswordForm: ({ redirect }: { redirect: string }) => (
    <div data-testid="update-password-form" data-redirect={redirect} />
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
});

describe("UpdatePasswordPage", () => {
  it("requires a valid recovery user before rendering", async () => {
    render(
      await UpdatePasswordPage({
        searchParams: Promise.resolve({ redirect: "/app/product/42" }),
      }),
    );
    expect(screen.getByTestId("update-password-form")).toHaveAttribute(
      "data-redirect",
      "/app/product/42",
    );
  });

  it("fails closed to the expired-link state without a user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(
      UpdatePasswordPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/auth/login?reason=expired&redirect=%2Fapp%2Fsearch",
    );
  });
});
