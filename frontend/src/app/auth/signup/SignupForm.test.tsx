import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { SignupForm } from "./SignupForm";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockSignUp = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
    functions: { invoke: vi.fn() },
  }),
}));

vi.mock("@/lib/toast", () => ({
  showToast: vi.fn(),
}));

// Mock TurnstileWidget to expose a trigger for simulating token receipt
let capturedOnSuccess: ((token: string) => void) | undefined;
let capturedOnError: (() => void) | undefined;
const mockTurnstileReset = vi.fn();

vi.mock("@/components/common/TurnstileWidget", () => ({
  TurnstileWidget: forwardRef(function MockTurnstileWidget(
    {
      onSuccess,
      onError,
    }: {
      onSuccess: (token: string) => void;
      onError?: () => void;
    },
    ref,
  ) {
    useImperativeHandle(ref, () => ({ reset: mockTurnstileReset }));
    useEffect(() => {
      capturedOnSuccess = onSuccess;
      capturedOnError = onError;
      return () => {
        capturedOnSuccess = undefined;
        capturedOnError = undefined;
      };
    }, [onError, onSuccess]);
    return (
      <div data-testid="turnstile-widget">
        <button
          data-testid="turnstile-trigger"
          onClick={() => onSuccess("mock-captcha-token")}
        >
          Verify
        </button>
      </div>
    );
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  capturedOnSuccess = undefined;
  capturedOnError = undefined;
});

function renderSelfServiceSignup() {
  return render(<SignupForm inviteOnly={false} />);
}

describe("SignupForm", () => {
  it("renders a truthful invitation-only state without signup controls", () => {
    render(<SignupForm inviteOnly />);

    expect(
      screen.getByRole("heading", { name: "Private beta access is invitation-only" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/small group of invited testers/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue with/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("turnstile-widget")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign Up" })).not.toBeInTheDocument();
  });

  it("links invited or existing users to sign in and password recovery", () => {
    render(<SignupForm inviteOnly />);

    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute(
      "href",
      "/auth/login",
    );
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/auth/forgot-password",
    );
  });

  it("does not offer social registration on the self-service form", () => {
    renderSelfServiceSignup();
    expect(screen.queryByRole("button", { name: /continue with/i })).not.toBeInTheDocument();
  });

  it("renders email and password fields", () => {
    renderSelfServiceSignup();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders password helper text", () => {
    renderSelfServiceSignup();
    expect(
      screen.getByText("Use at least 6 characters. A longer password is stronger."),
    ).toBeInTheDocument();
  });

  it("renders sign up button", () => {
    renderSelfServiceSignup();
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeInTheDocument();
  });

  it("renders the Turnstile widget", () => {
    renderSelfServiceSignup();
    expect(screen.getByTestId("turnstile-widget")).toBeInTheDocument();
  });

  it("disables submit button until Turnstile token is received", () => {
    renderSelfServiceSignup();
    const button = screen.getByRole("button", { name: "Sign Up" });
    expect(button).toBeDisabled();
  });

  it("enables submit button after Turnstile token is received", async () => {
    const user = userEvent.setup();
    renderSelfServiceSignup();

    await user.click(screen.getByTestId("turnstile-trigger"));

    const button = screen.getByRole("button", { name: "Sign Up" });
    expect(button).not.toBeDisabled();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    renderSelfServiceSignup();

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("shows captcha helper state before and after verification", async () => {
    const user = userEvent.setup();
    renderSelfServiceSignup();

    expect(
      screen.getByText("Complete the security check to enable sign up."),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("turnstile-trigger"));

    expect(
      screen.getByText("Security check complete. You can now create your account."),
    ).toBeInTheDocument();
  });

  it("renders sign in link", () => {
    renderSelfServiceSignup();
    expect(screen.getByText("Sign In").closest("a")).toHaveAttribute(
      "href",
      "/auth/login",
    );
  });

  it("requires minimum 6 character password", () => {
    renderSelfServiceSignup();
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("minLength", "6");
  });

  it("calls Supabase Auth exactly once after Turnstile verification", async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderSelfServiceSignup();
    await user.type(screen.getByLabelText("Email"), "new@user.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByTestId("turnstile-trigger"));
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledOnce();
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@user.com",
          password: "secret123",
        }),
      );
    });
  });

  it("passes captchaToken in signUp options", async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderSelfServiceSignup();
    await user.type(screen.getByLabelText("Email"), "new@user.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByTestId("turnstile-trigger"));
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            captchaToken: "mock-captcha-token",
          }),
        }),
      );
    });
  });

  it("shows success toast and redirects on success", async () => {
    const { showToast } = await import("@/lib/toast");
    mockSignUp.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderSelfServiceSignup();
    await user.type(screen.getByLabelText("Email"), "new@user.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByTestId("turnstile-trigger"));
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          messageKey: "auth.checkEmail",
        }),
      );
      expect(mockPush).toHaveBeenCalledWith("/auth/login?msg=check-email");
    });
  });

  it("shows error toast on auth failure", async () => {
    const { showToast } = await import("@/lib/toast");
    mockSignUp.mockResolvedValue({
      error: { message: "Email already in use" },
    });
    const user = userEvent.setup();

    renderSelfServiceSignup();
    await user.type(screen.getByLabelText("Email"), "dup@user.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByTestId("turnstile-trigger"));
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          message: "Email already in use",
        }),
      );
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeDisabled();
    expect(mockTurnstileReset).toHaveBeenCalledOnce();
  });

  it("shows 'Creating account…' while loading", async () => {
    mockSignUp.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    renderSelfServiceSignup();
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByTestId("turnstile-trigger"));
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(screen.getByText("Creating account…")).toBeInTheDocument();
    });
  });

  it("disables Turnstile token on error callback", async () => {
    renderSelfServiceSignup();
    // Simulate getting a token first, then an error
    await waitFor(() => {
      capturedOnSuccess?.("some-token");
    });
    await waitFor(() => {
      capturedOnError?.();
    });
    const button = screen.getByRole("button", { name: "Sign Up" });
    expect(button).toBeDisabled();
  });
});
