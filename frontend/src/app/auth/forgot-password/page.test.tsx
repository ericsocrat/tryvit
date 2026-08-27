import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./page";

vi.mock("@/components/common/LoadingSpinner", () => ({
  LoadingSpinner: ({ className }: { className?: string }) => (
    <div data-testid="loading-spinner" className={className} />
  ),
}));

vi.mock("./ForgotPasswordForm", () => ({
  ForgotPasswordForm: ({ redirect }: { redirect: string }) => (
    <div data-testid="forgot-password-form" data-redirect={redirect} />
  ),
}));

describe("ForgotPasswordPage", () => {
  it("preserves a safe app destination", async () => {
    render(
      await ForgotPasswordPage({
        searchParams: Promise.resolve({ redirect: "/app/product/42" }),
      }),
    );
    expect(screen.getByTestId("forgot-password-form")).toHaveAttribute(
      "data-redirect",
      "/app/product/42",
    );
  });

  it("rejects an external destination", async () => {
    render(
      await ForgotPasswordPage({
        searchParams: Promise.resolve({ redirect: "https://evil.com" }),
      }),
    );
    expect(screen.getByTestId("forgot-password-form")).toHaveAttribute(
      "data-redirect",
      "/app/search",
    );
  });
});
