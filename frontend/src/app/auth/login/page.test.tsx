import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const mockGetAuthCapabilities = vi.fn().mockResolvedValue({
  status: "ready",
  email: true,
  providers: ["google"],
  signupDisabled: true,
});

vi.mock("@/lib/auth-capabilities", () => ({
  getAuthCapabilities: () => mockGetAuthCapabilities(),
}));

vi.mock("./LoginForm", () => ({
  LoginForm: ({
    capabilities,
    inviteOnly,
  }: {
    capabilities: { providers: string[] };
    inviteOnly: boolean;
  }) => (
    <div
      data-testid="login-form"
      data-providers={capabilities.providers.join(",")}
      data-invite-only={String(inviteOnly)}
    />
  ),
}));

vi.mock("@/components/common/LoadingSpinner", () => ({
  LoadingSpinner: () => <div data-testid="spinner" />,
}));

describe("LoginPage", () => {
  it("resolves hosted capabilities before rendering the form", async () => {
    render(await LoginPage());
    expect(screen.getByTestId("login-form")).toHaveAttribute("data-providers", "google");
    expect(screen.getByTestId("login-form")).toHaveAttribute("data-invite-only", "true");
  });

  it("exports dynamic = force-dynamic", async () => {
    const mod = await import("./page");
    expect(mod.dynamic).toBe("force-dynamic");
  });
});
