import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SocialLoginButtons } from "./SocialLoginButtons";

const mockSignInWithOAuth = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  }),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "auth.continueWithGoogle": "Continue with Google",
        "auth.redirecting": "Redirecting…",
        "auth.orContinueWithEmail": "or continue with email",
        "auth.socialInviteMatchHint": "Use the same verified email as your invitation.",
      })[key] ?? key,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderProviders(
  providers: readonly "google"[],
  onError = vi.fn(),
  showEmailDivider = true,
) {
  render(
    <SocialLoginButtons
      providers={providers}
      redirect="/app/product/42?tab=nutrition"
      showEmailDivider={showEmailDivider}
      onError={onError}
    />,
  );
  return onError;
}

describe("SocialLoginButtons", () => {
  it("renders nothing when no hosted provider is enabled", () => {
    const { container } = render(
      <SocialLoginButtons providers={[]} redirect="/app/search" onError={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders only capability-backed providers", () => {
    renderProviders(["google"]);
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apple/i })).not.toBeInTheDocument();
    expect(screen.getByText(/continue with email/i)).toBeInTheDocument();
  });

  it("omits the email divider when email Auth is unavailable", () => {
    renderProviders(["google"], vi.fn(), false);
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
    expect(screen.queryByText(/continue with email/i)).not.toBeInTheDocument();
  });

  it("preserves the intended app destination in Google OAuth", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderProviders(["google"]);

    await user.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: expect.stringMatching(
            /\/auth\/callback\?redirect=%2Fapp%2Fproduct%2F42%3Ftab%3Dnutrition/u,
          ),
        },
      });
    });
  });

  it("disables Google while redirecting", async () => {
    mockSignInWithOAuth.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderProviders(["google"]);

    await user.click(screen.getByRole("button", { name: /google/i }));

    expect(screen.getByRole("button", { name: /redirecting/i })).toBeDisabled();
  });

  it("reports a stable provider error and re-enables controls", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      error: { code: "provider_disabled", message: "raw provider text" },
    });
    const onError = vi.fn();
    const user = userEvent.setup();
    renderProviders(["google"], onError);

    await user.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("auth.providerUnavailable");
      expect(screen.getByRole("button", { name: /google/i })).toBeEnabled();
    });
  });
});
