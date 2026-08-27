import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forwardRef, useImperativeHandle } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignupForm } from "./SignupForm";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignUp = vi.fn();
const mockTurnstileReset = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signUp: (...args: unknown[]) => mockSignUp(...args) },
  }),
}));

vi.mock("@/components/common/TurnstileWidget", () => ({
  TurnstileWidget: forwardRef(function MockTurnstileWidget(
    {
      onSuccess,
      size,
    }: {
      onSuccess: (token: string) => void;
      size?: string;
    },
    ref,
  ) {
    useImperativeHandle(ref, () => ({ reset: mockTurnstileReset }));
    return (
      <div data-testid="turnstile-widget" data-size={size}>
        <button type="button" data-testid="turnstile-trigger" onClick={() => onSuccess("token-1")}>
          Verify
        </button>
      </div>
    );
  }),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "auth.privateBetaShort": "Private beta",
        "auth.privateBetaTitle": "Private beta access is invitation-only",
        "auth.privateBetaDescription": "TryVit is open to invited testers.",
        "auth.privateBetaAccessNote": "Invitations are issued directly.",
        "auth.invitedAccountRequired": "An invited account is required.",
        "auth.signInContinue": "Sign in / continue",
        "auth.recoverInvitedAccount": "Recover invited account",
        "auth.accountAccess": "Account access",
        "auth.createAccount": "Create your account",
        "auth.signUpSubtitle": "Create a TryVit account.",
        "auth.hasAccount": "Already have an account?",
        "auth.signIn": "Sign In",
        "auth.email": "Email",
        "auth.emailPlaceholder": "you@example.com",
        "auth.password": "Password",
        "auth.confirmPassword": "Confirm password",
        "auth.passwordPlaceholder": "Enter your password",
        "auth.showPassword": "Show password",
        "auth.hidePassword": "Hide password",
        "auth.passwordHelp": "Use at least 6 characters.",
        "auth.passwordMismatch": "Passwords do not match.",
        "auth.captchaRequired": "Complete the security check.",
        "auth.captchaPrompt": "Complete the security check to enable sign up.",
        "auth.captchaVerified": "Security check complete.",
        "auth.signUp": "Sign Up",
        "auth.creatingAccount": "Creating account…",
        "auth.checkEmail": "Check your email.",
        "auth.signupFailed": "We could not create the account.",
        "auth.serviceUnavailable": "Account access is temporarily unavailable.",
      })[key] ?? key,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderSelfService() {
  return render(<SignupForm inviteOnly={false} redirect="/app/product/42" />);
}

async function completeSelfServiceForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "  new@user.com  ");
  await user.type(screen.getByLabelText("Password"), "secret123");
  await user.type(screen.getByLabelText("Confirm password"), "secret123");
  await user.click(screen.getByTestId("turnstile-trigger"));
  await user.click(screen.getByRole("button", { name: "Sign Up" }));
}

describe("SignupForm", () => {
  it("renders a truthful invitation-only state without signup controls", () => {
    render(<SignupForm inviteOnly redirect="/app/product/42" />);
    expect(
      screen.getByRole("heading", { name: "Private beta access is invitation-only" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByTestId("turnstile-widget")).not.toBeInTheDocument();
  });

  it("preserves the intended destination in invite entry links", () => {
    render(<SignupForm inviteOnly redirect="/app/product/42" />);
    expect(screen.getByRole("link", { name: "Sign in / continue" })).toHaveAttribute(
      "href",
      "/auth/login?redirect=%2Fapp%2Fproduct%2F42",
    );
    expect(screen.getByRole("link", { name: "Recover invited account" })).toHaveAttribute(
      "href",
      "/auth/forgot-password?redirect=%2Fapp%2Fproduct%2F42",
    );
  });

  it("keeps social registration absent from the dormant self-service form", () => {
    renderSelfService();
    expect(screen.queryByRole("button", { name: /continue with/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByTestId("turnstile-widget")).toHaveAttribute(
      "data-size",
      "compact",
    );
  });

  it("blocks mismatched passwords before Auth or CAPTCHA consumption", async () => {
    const user = userEvent.setup();
    renderSelfService();
    await user.type(screen.getByLabelText("Email"), "new@user.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.type(screen.getByLabelText("Confirm password"), "different123");
    await user.click(screen.getByTestId("turnstile-trigger"));
    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("passes one CAPTCHA token directly to Supabase Auth exactly once", async () => {
    mockSignUp.mockResolvedValue({ error: null });
    renderSelfService();
    await completeSelfServiceForm();

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledOnce();
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "new@user.com",
        password: "secret123",
        options: {
          emailRedirectTo: expect.stringMatching(
            /\/auth\/callback\?redirect=%2Fapp%2Fproduct%2F42/u,
          ),
          captchaToken: "token-1",
        },
      });
      expect(mockTurnstileReset).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith(
        "/auth/login?msg=check-email&redirect=%2Fapp%2Fproduct%2F42",
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("maps Auth failure without exposing raw backend text and resets CAPTCHA", async () => {
    mockSignUp.mockResolvedValue({
      error: { code: "signup_disabled", message: "raw backend detail" },
    });
    renderSelfService();
    await completeSelfServiceForm();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.privateBetaDenied");
      expect(mockTurnstileReset).toHaveBeenCalledOnce();
    });
    expect(screen.queryByText("raw backend detail")).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("keeps submit disabled until a CAPTCHA token exists", async () => {
    const user = userEvent.setup();
    renderSelfService();
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeDisabled();
    await user.click(screen.getByTestId("turnstile-trigger"));
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeEnabled();
  });
});
