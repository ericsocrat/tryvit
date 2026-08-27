import {
  isNativeSignupCaptchaEnabled,
  isPrivateBetaInviteOnly,
} from "@/lib/private-beta-admission";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignupPage from "./page";

const mockGetAuthCapabilities = vi.fn();

vi.mock("@/lib/auth-capabilities", () => ({
  getAuthCapabilities: () => mockGetAuthCapabilities(),
}));

vi.mock("./SignupForm", () => ({
  SignupForm: ({ inviteOnly, redirect }: { inviteOnly: boolean; redirect: string }) => (
    <div
      data-invite-only={String(inviteOnly)}
      data-redirect={redirect}
      data-testid="signup-form"
    />
  ),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function readyCapabilities(signupDisabled: boolean) {
  mockGetAuthCapabilities.mockResolvedValue({
    status: "ready",
    email: true,
    providers: [],
    signupDisabled,
  });
}

describe("SignupPage", () => {
  it("defaults to the invitation-only beta boundary", async () => {
    readyCapabilities(false);
    render(await SignupPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("signup-form")).toHaveAttribute("data-invite-only", "true");
    expect(mockGetAuthCapabilities).not.toHaveBeenCalled();
  });

  it("keeps the form closed when hosted signup is disabled", async () => {
    vi.stubEnv("TRYVIT_PRIVATE_BETA_INVITE_ONLY", "false");
    vi.stubEnv("TRYVIT_SUPABASE_NATIVE_CAPTCHA_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "production-site-key");
    readyCapabilities(true);

    render(await SignupPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("signup-form")).toHaveAttribute("data-invite-only", "true");
  });

  it("opens self-service only after every server-owned seal passes", async () => {
    vi.stubEnv("TRYVIT_PRIVATE_BETA_INVITE_ONLY", "false");
    vi.stubEnv("TRYVIT_SUPABASE_NATIVE_CAPTCHA_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "production-site-key");
    readyCapabilities(false);

    render(
      await SignupPage({
        searchParams: Promise.resolve({ redirect: "/app/product/42" }),
      }),
    );
    expect(screen.getByTestId("signup-form")).toHaveAttribute("data-invite-only", "false");
    expect(screen.getByTestId("signup-form")).toHaveAttribute(
      "data-redirect",
      "/app/product/42",
    );
  });

  it("fails closed for malformed flags", () => {
    expect(isPrivateBetaInviteOnly(undefined)).toBe(true);
    expect(isPrivateBetaInviteOnly("unexpected")).toBe(true);
    expect(isPrivateBetaInviteOnly(" FALSE ")).toBe(false);
    expect(isNativeSignupCaptchaEnabled(undefined)).toBe(false);
    expect(isNativeSignupCaptchaEnabled("unexpected")).toBe(false);
    expect(isNativeSignupCaptchaEnabled(" TRUE ")).toBe(true);
  });

  it("exports dynamic = force-dynamic", async () => {
    const mod = await import("./page");
    expect(mod.dynamic).toBe("force-dynamic");
  });
});
