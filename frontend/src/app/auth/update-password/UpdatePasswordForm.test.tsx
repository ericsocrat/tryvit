import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "auth.recoveryEyebrow": "Secure recovery",
        "auth.updatePasswordTitle": "Update your password",
        "auth.updatePasswordSubtitle": "Enter a new password for your account.",
        "auth.newPassword": "New password",
        "auth.confirmPassword": "Confirm password",
        "auth.updatePassword": "Update password",
        "auth.updatingPassword": "Updating…",
        "auth.backToLogin": "Back to login",
        "auth.showPassword": "Show password",
        "auth.hidePassword": "Hide password",
        "auth.passwordPlaceholder": "Enter your password",
        "auth.passwordHelp": "Use at least 6 characters.",
        "auth.passwordMismatch": "Passwords do not match.",
        "auth.passwordTooWeak": "Choose a stronger password.",
        "auth.passwordUpdateFailed": "We could not update your password.",
        "auth.serviceUnavailable": "Account access is temporarily unavailable.",
      })[key] ?? key,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSignOut.mockResolvedValue({ error: null });
});

function renderForm() {
  return render(<UpdatePasswordForm redirect="/app/product/42" />);
}

async function fillPasswords(first: string, second: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("New password"), first);
  await user.type(screen.getByLabelText("Confirm password"), second);
  await user.click(screen.getByRole("button", { name: "Update password" }));
  return user;
}

describe("UpdatePasswordForm", () => {
  it("renders password-manager-compatible confirmation fields", () => {
    renderForm();
    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
  });

  it("preserves the return destination in the login link", () => {
    renderForm();
    expect(screen.getByText("Back to login").closest("a")).toHaveAttribute(
      "href",
      "/auth/login?redirect=%2Fapp%2Fproduct%2F42",
    );
  });

  it("shows and focuses an inline mismatch error", async () => {
    renderForm();
    await fillPasswords("password1", "password2");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(screen.getAllByText("Passwords do not match.").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("updates once, clears only the local recovery session, and returns to login", async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    renderForm();
    await fillPasswords("newpass123", "newpass123");

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledOnce();
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "newpass123" });
      expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
      expect(mockPush).toHaveBeenCalledWith(
        "/auth/login?msg=password-updated&redirect=%2Fapp%2Fproduct%2F42",
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("maps weak-password errors without exposing backend text", async () => {
    mockUpdateUser.mockResolvedValue({
      error: { code: "weak_password", message: "backend policy detail" },
    });
    renderForm();
    await fillPasswords("weak12", "weak12");

    expect(
      (await screen.findAllByText("Choose a stronger password.")).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "aria-describedby",
      "new-password-error",
    );
    expect(screen.queryByText("backend policy detail")).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it.each([
    ["returned error", () => mockSignOut.mockResolvedValue({ error: new Error("close failed") })],
    ["thrown error", () => mockSignOut.mockRejectedValue(new Error("close failed"))],
  ])("does not claim a login return when local sign-out has a %s", async (_label, arrange) => {
    arrange();
    mockUpdateUser.mockResolvedValue({ error: null });
    renderForm();
    await fillPasswords("newpass123", "newpass123");

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/app/product/42");
      expect(mockPush).not.toHaveBeenCalledWith(
        expect.stringContaining("/auth/login"),
      );
    });
  });

  it("toggles both password fields independently", async () => {
    const user = userEvent.setup();
    renderForm();
    const toggles = screen.getAllByRole("button", { name: "Show password" });
    await user.click(toggles[0]);
    expect(screen.getByLabelText("New password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "type",
      "password",
    );
  });
});
