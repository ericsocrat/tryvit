import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SocialLoginButtons } from "./SocialLoginButtons";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockSignInWithOAuth = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  }),
}));

vi.mock("@/lib/toast", () => ({
  showToast: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("SocialLoginButtons", () => {
  // ─── Rendering ──────────────────────────────────────────────────────────

  it("renders Google login button", () => {
    render(<SocialLoginButtons />);
    expect(
      screen.getByRole("button", { name: /google/i }),
    ).toBeInTheDocument();
  });

  it("renders Apple login button", () => {
    render(<SocialLoginButtons />);
    expect(
      screen.getByRole("button", { name: /apple/i }),
    ).toBeInTheDocument();
  });

  it("renders 'or continue with email' divider", () => {
    render(<SocialLoginButtons />);
    expect(screen.getByText(/or continue with email/i)).toBeInTheDocument();
  });

  it("renders Google brand icon SVG", () => {
    render(<SocialLoginButtons />);
    const btn = screen.getByRole("button", { name: /google/i });
    expect(btn.querySelector("svg")).toBeInTheDocument();
  });

  it("renders Apple brand icon SVG", () => {
    render(<SocialLoginButtons />);
    const btn = screen.getByRole("button", { name: /apple/i });
    expect(btn.querySelector("svg")).toBeInTheDocument();
  });

  // ─── Google OAuth ─────────────────────────────────────────────────────

  it("calls signInWithOAuth with google provider on click", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<SocialLoginButtons />);
    await user.click(screen.getByRole("button", { name: /google/i }));

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: expect.stringContaining("/auth/callback"),
      },
    });
  });

  it("disables both buttons while Google login is loading", async () => {
    mockSignInWithOAuth.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<SocialLoginButtons />);
    await user.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "…" })).toBeDisabled();
      expect(screen.getByRole("button", { name: /apple/i })).toBeDisabled();
    });
  });

  it("shows error toast when Google login fails", async () => {
    const { showToast } = await import("@/lib/toast");
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: "Provider not configured" },
    });
    const user = userEvent.setup();

    render(<SocialLoginButtons />);
    await user.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
        }),
      );
    });
  });

  // ─── Apple OAuth ──────────────────────────────────────────────────────

  it("calls signInWithOAuth with apple provider on click", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<SocialLoginButtons />);
    await user.click(screen.getByRole("button", { name: /apple/i }));

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "apple",
      options: {
        redirectTo: expect.stringContaining("/auth/callback"),
      },
    });
  });

  it("disables both buttons while Apple login is loading", async () => {
    mockSignInWithOAuth.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<SocialLoginButtons />);
    await user.click(screen.getByRole("button", { name: /apple/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /google/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: "…" })).toBeDisabled();
    });
  });

  it("shows error toast when Apple login fails", async () => {
    const { showToast } = await import("@/lib/toast");
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: "Apple auth error" },
    });
    const user = userEvent.setup();

    render(<SocialLoginButtons />);
    await user.click(screen.getByRole("button", { name: /apple/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
        }),
      );
    });
  });

  // ─── Re-enable after error ────────────────────────────────────────────

  it("re-enables buttons after an error", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: "Failed" },
    });
    const user = userEvent.setup();

    render(<SocialLoginButtons />);
    await user.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => {
      const googleBtn = screen.getByRole("button", { name: /google/i });
      expect(googleBtn).not.toBeDisabled();
    });
  });
});
