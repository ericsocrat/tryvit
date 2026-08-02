import { render, screen } from "@testing-library/react";
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
});

describe("AuthenticatedProviders", () => {
  it("retains app-only query, flag, achievement, and telemetry behavior", () => {
    render(
      <AuthenticatedProviders>
        <p>Authenticated application</p>
      </AuthenticatedProviders>,
    );

    expect(screen.getByTestId("flag-provider")).toBeInTheDocument();
    expect(screen.getByText("Authenticated application")).toBeInTheDocument();
    expect(mockInitAchievements).toHaveBeenCalledOnce();
    expect(mockReportWebVitals).toHaveBeenCalledOnce();
  });
});
