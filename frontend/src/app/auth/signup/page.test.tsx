import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { isPrivateBetaInviteOnly } from "@/lib/private-beta-admission";
import SignupPage from "./page";

vi.mock("./SignupForm", () => ({
  SignupForm: ({ inviteOnly }: { inviteOnly?: boolean }) => (
    <div data-invite-only={String(inviteOnly)} data-testid="signup-form" />
  ),
}));

describe("SignupPage", () => {
  it("defaults to the invitation-only beta boundary", () => {
    render(<SignupPage />);
    expect(screen.getByTestId("signup-form")).toHaveAttribute("data-invite-only", "true");
  });

  it("allows self-service signup only when the server flag is explicitly false", () => {
    vi.stubEnv("TRYVIT_PRIVATE_BETA_INVITE_ONLY", "false");
    render(<SignupPage />);
    expect(screen.getByTestId("signup-form")).toHaveAttribute("data-invite-only", "false");
    vi.unstubAllEnvs();
  });

  it("fails closed for unset or unexpected flag values", () => {
    expect(isPrivateBetaInviteOnly(undefined)).toBe(true);
    expect(isPrivateBetaInviteOnly("true")).toBe(true);
    expect(isPrivateBetaInviteOnly("unexpected")).toBe(true);
    expect(isPrivateBetaInviteOnly(" FALSE ")).toBe(false);
  });

  it("exports dynamic = force-dynamic", async () => {
    const mod = await import("./page");
    expect(mod.dynamic).toBe("force-dynamic");
  });
});
