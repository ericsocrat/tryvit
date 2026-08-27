import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSearchParams = new URLSearchParams();
const mockSignIn = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
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
    auth: { signInWithPassword: (...args: unknown[]) => mockSignIn(...args) },
  }),
}));

vi.mock("@/components/auth/SocialLoginButtons", () => ({
  SocialLoginButtons: ({ providers }: { providers: string[] }) =>
    providers.length > 0 ? (
      <div data-testid="social-login-buttons" data-providers={providers.join(",")} />
    ) : null,
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "auth.privateBetaShort": "Private beta",
        "auth.accountAccess": "Account access",
        "auth.welcomeBack": "Welcome back",
        "auth.signInSubtitle": "Sign in in seconds.",
        "auth.invitedAccessPrompt": "Invitation only.",
        "auth.learnAboutPrivateBeta": "How private beta works",
        "auth.noAccount": "Don't have an account?",
        "auth.signUp": "Sign Up",
        "auth.signIn": "Sign In",
        "auth.signingIn": "Signing in…",
        "auth.email": "Email",
        "auth.emailPlaceholder": "you@example.com",
        "auth.password": "Password",
        "auth.passwordPlaceholder": "Enter your password",
        "auth.showPassword": "Show password",
        "auth.hidePassword": "Hide password",
        "auth.forgotPassword": "Forgot password?",
        "auth.invalidCredentials": "Invalid email or password.",
        "auth.emailNotConfirmed": "Confirm your email before signing in.",
        "auth.tooManyAttempts": "Too many attempts.",
        "auth.serviceUnavailable": "Account access is temporarily unavailable.",
        "auth.providerStatusUnavailable":
          "Social sign-in status is temporarily unavailable. Email sign-in remains available.",
        "auth.sessionExpiredBanner": "Your session has expired.",
        "auth.privateBetaDenied": "This account is not admitted.",
        "auth.providerCallbackFailed": "The provider could not complete sign-in.",
        "auth.checkEmail": "Check your email.",
        "auth.passwordUpdated": "Password updated successfully.",
        "auth.invitedAccountRequired": "An invited account is required.",
        "auth.invitedProviderHint": "Use the same verified email.",
        "auth.noAuthMethodAvailable": "No sign-in method is available.",
      })[key] ?? key,
  }),
}));

const READY_CAPABILITIES = {
  status: "ready" as const,
  email: true,
  providers: [] as const,
  signupDisabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of [...mockSearchParams.keys()]) mockSearchParams.delete(key);
});

describe("LoginForm", () => {
  it("shows only provider controls backed by hosted capabilities", () => {
    const { rerender } = render(<LoginForm capabilities={READY_CAPABILITIES} />);
    expect(screen.queryByTestId("social-login-buttons")).not.toBeInTheDocument();

    rerender(
      <LoginForm
        capabilities={{ ...READY_CAPABILITIES, providers: ["google"] }}
      />,
    );
    expect(screen.getByTestId("social-login-buttons")).toHaveAttribute(
      "data-providers",
      "google",
    );
  });

  it("renders password-manager-compatible email and password fields", () => {
    render(<LoginForm capabilities={READY_CAPABILITIES} />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("trims email and returns to the intended app destination", async () => {
    mockSearchParams.set("redirect", "/app/product/42?tab=nutrition");
    mockSignIn.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginForm capabilities={READY_CAPABILITIES} />);

    await user.type(screen.getByLabelText("Email"), "  a@b.com  ");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({ email: "a@b.com", password: "secret" });
      expect(mockPush).toHaveBeenCalledWith("/app/product/42?tab=nutrition");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("renders a focused inline error without exposing backend text", async () => {
    mockSignIn.mockResolvedValue({
      error: { code: "invalid_credentials", message: "backend detail" },
    });
    const user = userEvent.setup();
    render(<LoginForm capabilities={READY_CAPABILITIES} />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(screen.getAllByText("Invalid email or password.").length).toBeGreaterThan(0);
    expect(screen.queryByText("backend detail")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("maps stable rate-limit codes", async () => {
    mockSignIn.mockResolvedValue({ error: { code: "over_request_rate_limit" } });
    const user = userEvent.setup();
    render(<LoginForm capabilities={READY_CAPABILITIES} />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Too many attempts.")).toBeInTheDocument();
  });

  it.each([
    ["expired", "Your session has expired."],
    ["invite-only", "This account is not admitted."],
    ["provider", "The provider could not complete sign-in."],
  ])("renders the %s recovery state", (reason, message) => {
    mockSearchParams.set("reason", reason);
    render(<LoginForm capabilities={READY_CAPABILITIES} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("preserves redirect intent in recovery and beta links", () => {
    mockSearchParams.set("redirect", "/app/product/42");
    render(<LoginForm capabilities={READY_CAPABILITIES} />);
    expect(screen.getByText("Forgot password?").closest("a")).toHaveAttribute(
      "href",
      "/auth/forgot-password?redirect=%2Fapp%2Fproduct%2F42",
    );
    expect(screen.getByText("How private beta works").closest("a")).toHaveAttribute(
      "href",
      "/auth/signup?redirect=%2Fapp%2Fproduct%2F42",
    );
  });

  it("keeps the server invitation seal authoritative if hosted settings diverge", () => {
    render(
      <LoginForm
        capabilities={{ ...READY_CAPABILITIES, signupDisabled: false }}
      />,
    );
    expect(screen.getByText("How private beta works")).toBeInTheDocument();
    expect(screen.queryByText("Sign Up")).not.toBeInTheDocument();
  });

  it("advertises self-service only when both boundaries are open", () => {
    render(
      <LoginForm
        capabilities={{ ...READY_CAPABILITIES, signupDisabled: false }}
        inviteOnly={false}
      />,
    );
    expect(screen.getByText("Sign Up")).toBeInTheDocument();
  });

  it("toggles password visibility with pressed state", async () => {
    const user = userEvent.setup();
    render(<LoginForm capabilities={READY_CAPABILITIES} />);
    const password = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    await user.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("fails closed when Auth capabilities cannot be resolved", () => {
    render(
      <LoginForm
        capabilities={{
          status: "unavailable",
          email: true,
          providers: [],
          signupDisabled: true,
        }}
      />,
    );
    expect(screen.getByText(/email sign-in remains available/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeEnabled();
  });
});
