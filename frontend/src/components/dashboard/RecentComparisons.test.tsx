import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentComparisons } from "./RecentComparisons";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) {
        let result = key;
        for (const [k, v] of Object.entries(params)) {
          result += `|${k}=${v}`;
        }
        return result;
      }
      return key;
    },
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  Scale: (props: Record<string, unknown>) => (
    <svg data-testid="scale-icon" {...props} />
  ),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const COMPARISONS = [
  {
    id: 1,
    title: "Best yogurts",
    product_count: 3,
    created_at: "2026-02-15T10:00:00Z",
  },
  {
    id: 2,
    title: null,
    product_count: 2,
    created_at: "2026-02-16T12:00:00Z",
  },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("RecentComparisons", () => {
  it("renders nothing when comparisons is empty", () => {
    const { container } = render(<RecentComparisons comparisons={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the section when comparisons exist", () => {
    render(<RecentComparisons comparisons={COMPARISONS} />);
    expect(screen.getByTestId("recent-comparisons")).toBeInTheDocument();
  });

  it("displays section title", () => {
    render(<RecentComparisons comparisons={COMPARISONS} />);
    expect(
      screen.getByText("dashboard.recentComparisons"),
    ).toBeInTheDocument();
  });

  it("shows view all link", () => {
    render(<RecentComparisons comparisons={COMPARISONS} />);
    const viewAll = screen.getByText("dashboard.viewAll");
    expect(viewAll.closest("a")).toHaveAttribute("href", "/app/compare");
  });

  it("renders comparison cards with correct links", () => {
    render(<RecentComparisons comparisons={COMPARISONS} />);
    const links = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("href")?.includes("ids="));
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/app/compare?ids=1");
    expect(links[1]).toHaveAttribute("href", "/app/compare?ids=2");
  });

  it("displays comparison title or fallback for null title", () => {
    render(<RecentComparisons comparisons={COMPARISONS} />);
    expect(screen.getByText("Best yogurts")).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.untitledComparison"),
    ).toBeInTheDocument();
  });

  it("displays product count with i18n key", () => {
    render(<RecentComparisons comparisons={COMPARISONS} />);
    // product count is passed as param — appears as key|count=N
    const countTexts = screen.getAllByText(
      /dashboard\.comparisonProducts\|count=/,
    );
    expect(countTexts).toHaveLength(2);
  });
});
