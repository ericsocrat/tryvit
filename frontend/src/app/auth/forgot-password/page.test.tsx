import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./page";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/components/common/LoadingSpinner", () => ({
  LoadingSpinner: ({ className }: { className?: string }) => (
    <div data-testid="loading-spinner" className={className} />
  ),
}));

vi.mock("./ForgotPasswordForm", () => ({
  ForgotPasswordForm: () => (
    <div data-testid="forgot-password-form" />
  ),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ForgotPasswordPage", () => {
  it("renders the forgot-password form", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId("forgot-password-form")).toBeInTheDocument();
  });
});
