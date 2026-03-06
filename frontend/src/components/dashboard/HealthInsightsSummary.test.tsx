import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthInsightsSummary } from "./HealthInsightsSummary";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/constants", () => ({
  SCORE_BANDS: {
    low: {
      label: "Excellent",
      color: "text-score-green-text",
      bg: "bg-score-green/10",
    },
    moderate: {
      label: "Good",
      color: "text-score-yellow-text",
      bg: "bg-score-yellow/10",
    },
    high: {
      label: "Moderate",
      color: "text-score-orange-text",
      bg: "bg-score-orange/10",
    },
    very_high: {
      label: "Poor",
      color: "text-score-red-text",
      bg: "bg-score-red/10",
    },
  },
  scoreBandFromScore: (score: number) => {
    if (score <= 25) return "low";
    if (score <= 50) return "moderate";
    if (score <= 75) return "high";
    return "very_high";
  },
}));

vi.mock("lucide-react", () => ({
  TrendingUp: (props: Record<string, unknown>) => (
    <svg data-testid="trending-up" {...props} />
  ),
  TrendingDown: (props: Record<string, unknown>) => (
    <svg data-testid="trending-down" {...props} />
  ),
  Minus: (props: Record<string, unknown>) => (
    <svg data-testid="minus" {...props} />
  ),
  Activity: (props: Record<string, unknown>) => (
    <svg data-testid="activity" {...props} />
  ),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("HealthInsightsSummary", () => {
  it("renders the widget", () => {
    render(<HealthInsightsSummary avgScore={15} scoreTrend="stable" />);
    expect(screen.getByTestId("health-insights-summary")).toBeInTheDocument();
  });

  it("displays rounded avg score", () => {
    render(<HealthInsightsSummary avgScore={15.7} scoreTrend="stable" />);
    expect(screen.getByText("16")).toBeInTheDocument();
  });

  it("displays title text", () => {
    render(<HealthInsightsSummary avgScore={20} scoreTrend="stable" />);
    expect(
      screen.getByText("dashboard.healthInsightsTitle"),
    ).toBeInTheDocument();
  });

  // ─── Score Bands ────────────────────────────────────────────────────────

  it("maps low score to low band label", () => {
    render(<HealthInsightsSummary avgScore={10} scoreTrend="stable" />);
    expect(screen.getByText("dashboard.scoreBand.low")).toBeInTheDocument();
  });

  it("maps moderate score to moderate band label", () => {
    render(<HealthInsightsSummary avgScore={40} scoreTrend="stable" />);
    expect(
      screen.getByText("dashboard.scoreBand.moderate"),
    ).toBeInTheDocument();
  });

  it("maps high score to high band label", () => {
    render(<HealthInsightsSummary avgScore={65} scoreTrend="stable" />);
    expect(screen.getByText("dashboard.scoreBand.high")).toBeInTheDocument();
  });

  it("maps very high score to very_high band label", () => {
    render(<HealthInsightsSummary avgScore={90} scoreTrend="stable" />);
    expect(
      screen.getByText("dashboard.scoreBand.very_high"),
    ).toBeInTheDocument();
  });

  // ─── Trend Icons ──────────────────────────────────────────────────────

  it("shows TrendingDown icon for improving trend (lower = healthier)", () => {
    render(<HealthInsightsSummary avgScore={15} scoreTrend="improving" />);
    expect(screen.getByTestId("trending-down")).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.scoreTrend.improving"),
    ).toBeInTheDocument();
  });

  it("shows TrendingUp icon for worsening trend", () => {
    render(<HealthInsightsSummary avgScore={50} scoreTrend="worsening" />);
    expect(screen.getByTestId("trending-up")).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.scoreTrend.worsening"),
    ).toBeInTheDocument();
  });

  it("shows Minus icon for stable trend", () => {
    render(<HealthInsightsSummary avgScore={30} scoreTrend="stable" />);
    expect(screen.getByTestId("minus")).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.scoreTrend.stable"),
    ).toBeInTheDocument();
  });

  // ─── Score Circle ─────────────────────────────────────────────────────

  it("renders avg-score-circle with band bg class", () => {
    render(<HealthInsightsSummary avgScore={10} scoreTrend="stable" />);
    const circle = screen.getByTestId("avg-score-circle");
    expect(circle.className).toContain("bg-score-green/10");
  });
});
