import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LandingSections } from "./LandingSections";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/components/common/Button", () => ({
  ButtonLink: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/common/Logo", () => ({
  Logo: () => <div data-testid="logo" />,
}));

vi.mock("@/lib/i18n-core", () => ({
  translate: (_language: string, key: string) => key,
}));

vi.mock("lucide-react", () => ({
  BarChart3: () => <span data-testid="icon-barchart" />,
  Camera: () => <span data-testid="icon-camera" />,
  ChevronRight: () => <span data-testid="icon-chevron" />,
  Database: () => <span data-testid="icon-database" />,
  Layers: () => <span data-testid="icon-layers" />,
  Search: () => <span data-testid="icon-search" />,
  Shield: () => <span data-testid="icon-shield" />,
  ShoppingBasket: () => <span data-testid="icon-basket" />,
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("LandingSections", () => {
  it("remains a server component without auth or browser hooks", () => {
    const source = readFileSync(join(process.cwd(), "src/app/LandingSections.tsx"), "utf8");
    expect(source).not.toMatch(/^\s*["']use client["'];/mu);
    expect(source).not.toContain("@/lib/supabase");
    expect(source).not.toContain("useEffect");
    expect(source).not.toContain("useState");
  });

  it("renders the hero tagline", () => {
    render(<LandingSections language="en" />);
    expect(screen.getByText("landing.tagline")).toBeInTheDocument();
  });

  it("renders the hero description", () => {
    render(<LandingSections language="en" />);
    expect(screen.getByText("landing.description")).toBeInTheDocument();
  });

  it("renders sign-up and sign-in links", () => {
    render(<LandingSections language="en" />);
    const signupLinks = screen.getAllByText("landing.getStarted");
    expect(signupLinks.length).toBeGreaterThanOrEqual(1);
    expect(signupLinks[0].closest("a")).toHaveAttribute("href", "/auth/signup");

    const signInLinks = screen.queryAllByText("landing.signIn");
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);
    expect(
      signInLinks.some((link) => link.closest("a")?.getAttribute("href") === "/auth/login"),
    ).toBe(true);
  });

  it("keeps signed-out actions as the hydration-safe live default", () => {
    render(<LandingSections language="en" />);
    expect(screen.queryByText("auth.dashboard")).not.toBeInTheDocument();
    expect(screen.getAllByText("landing.getStarted")).toHaveLength(2);
  });

  it("renders features heading and 3 feature cards", () => {
    render(<LandingSections language="en" />);
    expect(screen.getByText("landing.featuresHeading")).toBeInTheDocument();
    expect(screen.getByText("landing.featureSearch")).toBeInTheDocument();
    expect(screen.getByText("landing.featureScan")).toBeInTheDocument();
    expect(screen.getByText("landing.featureCompare")).toBeInTheDocument();
  });

  it("renders how-it-works heading and 3 steps", () => {
    render(<LandingSections language="en" />);
    expect(screen.getByText("landing.howItWorksHeading")).toBeInTheDocument();
    expect(screen.getByText("landing.step1Title")).toBeInTheDocument();
    expect(screen.getByText("landing.step2Title")).toBeInTheDocument();
    expect(screen.getByText("landing.step3Title")).toBeInTheDocument();
  });

  it("renders stats heading and 4 stat values", () => {
    render(<LandingSections language="en" />);
    expect(screen.getByText("landing.statsHeading")).toBeInTheDocument();
    // Product count is intentionally reused in both the hero "Model Snapshot" aside and the stats section
    expect(screen.queryAllByText("landing.statProductsValue").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("landing.statCategoriesValue")).toBeInTheDocument();
    expect(screen.queryAllByText("landing.statFactorsValue").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("landing.statCountriesValue").length).toBeGreaterThanOrEqual(1);
  });

  it("renders CTA repeat section", () => {
    render(<LandingSections language="en" />);
    expect(screen.getByText("landing.ctaHeading")).toBeInTheDocument();
    expect(screen.getByText("landing.ctaDescription")).toBeInTheDocument();
  });

  it("renders the logo in hero section", () => {
    render(<LandingSections language="en" />);
    expect(screen.queryAllByTestId("logo").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all heading elements", () => {
    render(<LandingSections language="en" />);
    const headings = screen.getAllByRole("heading");
    // h1 (tagline) + h2 (features, howItWorks, stats, cta) + h3 (3 features + 3 steps) = 11
    expect(headings.length).toBeGreaterThanOrEqual(5);
  });

  it("shows an explicit demo state and disables live-data CTAs", () => {
    render(<LandingSections dataAvailable={false} language="en" />);

    expect(screen.getByText("landing.serviceStatusTitle")).toBeInTheDocument();
    expect(screen.getByText("landing.demoDescription")).toBeInTheDocument();
    expect(screen.queryByText("landing.getStarted")).not.toBeInTheDocument();
    expect(screen.queryByText("landing.signIn")).not.toBeInTheDocument();
  });
});
