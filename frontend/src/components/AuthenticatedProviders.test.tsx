import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedProviders } from "@/components/AuthenticatedProviders";

const { mockInitAchievements, mockReportWebVitals } = vi.hoisted(() => ({
  mockInitAchievements: vi.fn(() => vi.fn()),
  mockReportWebVitals: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  initAchievementMiddleware: mockInitAchievements,
}));

vi.mock("@/lib/web-vitals", () => ({
  reportWebVitals: mockReportWebVitals,
}));

vi.mock("@/lib/flags", () => ({
  FlagProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="flag-provider">{children}</div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("AuthenticatedProviders", () => {
  it("retains app-only query, flag, achievement, and configured telemetry behavior", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.invalid/1");
    render(
      <AuthenticatedProviders>
        <p>Authenticated application</p>
      </AuthenticatedProviders>,
    );

    expect(screen.getByTestId("flag-provider")).toBeInTheDocument();
    expect(screen.getByText("Authenticated application")).toBeInTheDocument();
    expect(mockInitAchievements).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(mockReportWebVitals).toHaveBeenCalledOnce();
    });
  });

  it("does not load web-vitals telemetry when the public DSN is blank", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    render(
      <AuthenticatedProviders>
        <p>Authenticated application</p>
      </AuthenticatedProviders>,
    );
    await vi.dynamicImportSettled();

    expect(mockInitAchievements).toHaveBeenCalledOnce();
    expect(mockReportWebVitals).not.toHaveBeenCalled();
  });
});
