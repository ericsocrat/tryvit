import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AllergensPage from "./page";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/layout/Header", () => ({
  Header: () => <header data-testid="header" />,
}));

vi.mock("@/components/layout/Footer", () => ({
  Footer: () => <footer data-testid="footer" />,
}));

vi.mock("@/components/common/SkipLink", () => ({
  SkipLink: () => <div data-testid="skip-link" />,
}));

vi.mock("@/components/learn/LearnSidebar", () => ({
  LearnSidebar: () => <nav data-testid="learn-sidebar" />,
}));

vi.mock("@/components/learn/Disclaimer", () => ({
  Disclaimer: () => <div data-testid="disclaimer" />,
}));

vi.mock("@/components/learn/SourceCitation", () => ({
  SourceCitation: ({ title }: { title: string }) => (
    <div data-testid="source-citation">{title}</div>
  ),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("AllergensPage", () => {
  it("renders the page title", () => {
    render(<AllergensPage />);
    expect(screen.getByText("learn.allergens.title")).toBeInTheDocument();
  });

  it("renders the summary block", () => {
    render(<AllergensPage />);
    expect(screen.getByText("learn.allergens.summary")).toBeInTheDocument();
  });

  it("renders EU 14 allergens heading", () => {
    render(<AllergensPage />);
    expect(
      screen.getByText("learn.allergens.eu14Title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("learn.allergens.eu14Text"),
    ).toBeInTheDocument();
  });

  it("renders all 14 allergen items", () => {
    render(<AllergensPage />);
    const listItems = screen.getAllByRole("listitem");
    // Filter to only allergen items (page may have other list items)
    const allergenItems = listItems.filter((li) =>
      li.textContent?.startsWith("learn.allergens.allergen"),
    );
    expect(allergenItems).toHaveLength(14);
  });

  it("renders containsVsTraces section", () => {
    render(<AllergensPage />);
    expect(
      screen.getByText("learn.allergens.containsVsTracesTitle"),
    ).toBeInTheDocument();
  });

  it("renders polishLabels section", () => {
    render(<AllergensPage />);
    expect(
      screen.getByText("learn.allergens.polishLabelsTitle"),
    ).toBeInTheDocument();
  });

  it("renders inTryVit section", () => {
    render(<AllergensPage />);
    expect(
      screen.getByText("learn.allergens.inTryVitTitle"),
    ).toBeInTheDocument();
  });

  it("renders layout components", () => {
    render(<AllergensPage />);
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
    expect(screen.getByTestId("learn-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("disclaimer")).toBeInTheDocument();
  });

  it("renders source citation", () => {
    render(<AllergensPage />);
    const citations = screen.getAllByTestId("source-citation");
    expect(citations).toHaveLength(1);
  });

  it("renders back-to-hub link", () => {
    render(<AllergensPage />);
    const backLink = screen.getByText("learn.backToHub");
    expect(backLink.closest("a")).toHaveAttribute("href", "/learn");
  });
});
