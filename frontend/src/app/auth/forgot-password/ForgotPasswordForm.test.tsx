import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockResetPassword = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: (...args: unknown[]) =>
        mockResetPassword(...args),
    },
  }),
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

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "auth.email": "Email",
        "auth.emailPlaceholder": "you@example.com",
        "auth.resetPasswordTitle": "Reset password",
        "auth.resetPasswordSubtitle":
          "Enter your email and we\u2019ll send you a link to reset your password.",
        "auth.sendResetLink": "Send reset link",
        "auth.sendingResetLink": "Sending\u2026",
        "auth.resetEmailFailed": "Could not send reset email. Please try again.",
        "auth.resetEmailSent":
          "If an account exists with that email, you\u2019ll receive a password reset link shortly.",
        "auth.backToLogin": "Back to login",
        "auth.recoveryEyebrow": "Secure recovery",
        "auth.serviceUnavailable": "Account access is temporarily unavailable.",
        "landing.tagline": "tagline",
      };
      return map[key] ?? key;
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  return render(<ForgotPasswordForm redirect="/app/product/42" />);
}

describe("ForgotPasswordForm", () => {
  it("renders email input and submit button", () => {
    renderForm();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send reset link" }),
    ).toBeInTheDocument();
  });

  it("renders back to login link", () => {
    renderForm();
    const link = screen.getByText("Back to login").closest("a");
    expect(link).toHaveAttribute(
      "href",
      "/auth/login?redirect=%2Fapp%2Fproduct%2F42",
    );
  });

  it("calls resetPasswordForEmail on submit", async () => {
    mockResetPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderForm();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(
      screen.getByRole("button", { name: "Send reset link" }),
    );

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith("test@example.com", {
        redirectTo: expect.stringMatching(
          /\/auth\/callback\?type=recovery&redirect=%2Fapp%2Fproduct%2F42/u,
        ),
      });
    });
  });

  it("shows success state after submission", async () => {
    mockResetPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderForm();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(
      screen.getByRole("button", { name: "Send reset link" }),
    );

    await waitFor(() => {
      // Form should be replaced with success message
      expect(
        screen.queryByRole("button", { name: "Send reset link" }),
      ).not.toBeInTheDocument();
    });

    // Back to login button visible in success state
    expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute(
      "href",
      "/auth/login?redirect=%2Fapp%2Fproduct%2F42",
    );
  });

  it("shows the enumeration-safe success message after submission", async () => {
    mockResetPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderForm();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(
      screen.getByRole("button", { name: "Send reset link" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /if an account exists/i,
      );
    });
  });

  it("shows sending state while loading", async () => {
    mockResetPassword.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    renderForm();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(
      screen.getByRole("button", { name: "Send reset link" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Sending…")).toBeInTheDocument();
    });
  });

  it("shows an inline error and keeps the form visible on reset failure", async () => {
    mockResetPassword.mockResolvedValue({
      error: { message: "service unavailable" },
    });
    const user = userEvent.setup();

    renderForm();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(
      screen.getByRole("button", { name: "Send reset link" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not send reset email. Please try again.",
      );
    });

    expect(
      screen.getByRole("button", { name: "Send reset link" }),
    ).toBeInTheDocument();
  });
});
