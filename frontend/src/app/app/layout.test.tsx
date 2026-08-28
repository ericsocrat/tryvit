import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  }),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "accept-language": "en" }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children }: Readonly<{ children: React.ReactNode }>) => (
    <span data-testid="client-navigation-link">{children}</span>
  ),
}));

import AppLayout from "./layout";

describe("AppLayout transient preference failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { email: "private-beta@test.tryvit.local" } },
    });
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error("preferences temporarily unavailable"),
    });
  });

  it("uses a hard-navigation retry so the failed server layout runs again", async () => {
    render(await AppLayout({ children: <div>Protected content</div> }));

    const retry = screen.getByRole("link", { name: "Try again" });
    expect(retry).toHaveAttribute("href", "/app/search");
    expect(screen.queryByTestId("client-navigation-link")).not.toBeInTheDocument();
  });
});
