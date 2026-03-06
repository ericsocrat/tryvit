import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryDiversity } from "./CategoryDiversity";

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
  Compass: (props: Record<string, unknown>) => (
    <svg data-testid="compass-icon" {...props} />
  ),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("CategoryDiversity", () => {
  it("renders nothing when explored is 0", () => {
    const { container } = render(
      <CategoryDiversity diversity={{ explored: 0, total: 20 }} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the widget when explored > 0", () => {
    render(<CategoryDiversity diversity={{ explored: 5, total: 20 }} />);
    expect(screen.getByTestId("category-diversity")).toBeInTheDocument();
  });

  it("displays title text", () => {
    render(<CategoryDiversity diversity={{ explored: 3, total: 10 }} />);
    expect(
      screen.getByText("dashboard.categoryDiversityTitle"),
    ).toBeInTheDocument();
  });

  it("renders progress bar with correct value and max", () => {
    render(<CategoryDiversity diversity={{ explored: 7, total: 20 }} />);
    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("value", "7");
    expect(progress).toHaveAttribute("max", "20");
  });

  it("sets aria-label on progress bar with params", () => {
    render(<CategoryDiversity diversity={{ explored: 7, total: 20 }} />);
    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute(
      "aria-label",
      "dashboard.categoryDiversityAria|explored=7|total=20",
    );
  });

  it("displays fraction text", () => {
    render(<CategoryDiversity diversity={{ explored: 7, total: 20 }} />);
    expect(screen.getByText("7/20")).toBeInTheDocument();
  });

  it("shows discover link when explored < total", () => {
    render(<CategoryDiversity diversity={{ explored: 5, total: 20 }} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/app/categories");
    expect(link).toHaveTextContent("dashboard.categoryDiversityDiscover");
  });

  it("hides discover link when explored === total", () => {
    render(<CategoryDiversity diversity={{ explored: 20, total: 20 }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
