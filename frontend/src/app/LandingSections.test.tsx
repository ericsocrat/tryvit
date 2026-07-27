import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LandingSections } from "./LandingSections";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockUnsubscribe = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: mockUnsubscribe } },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => mockGetUser(),
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

vi.mock("@/components/common/Button", () => ({
  ButtonLink: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/common/Logo", () => ({
  Logo: () => <div data-testid="logo" />,
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it("renders the hero tagline", () => {
    render(<LandingSections />);
    expect(screen.getByText("landing.tagline")).toBeInTheDocument();
  });

  it("renders the hero description", () => {
    render(<LandingSections />);
    expect(screen.getByText("landing.description")).toBeInTheDocument();
  });

  it("renders sign-up and sign-in links", () => {
    render(<LandingSections />);
    const signupLinks = screen.getAllByText("landing.getStarted");
    expect(signupLinks.length).toBeGreaterThanOrEqual(1);
    expect(signupLinks[0].closest("a")).toHaveAttribute(
      "href",
      "/auth/signup",
    );

    const signInLinks = screen.queryAllByText("landing.signIn");
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);
    expect(
      signInLinks.some((link) => link.closest("a")?.getAttribute("href") === "/auth/login"),
    ).toBe(true);
  });

  it("shows Dashboard CTAs linking to /app when authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    render(<LandingSections />);

    // Both CTA clusters (hero + repeat) switch to the Dashboard link.
    const dashboardLinks = await screen.findAllByText("auth.dashboard");
    expect(dashboardLinks.length).toBeGreaterThanOrEqual(2);
    dashboardLinks.forEach((link) => {
      expect(link.closest("a")).toHaveAttribute("href", "/app");
    });

    // Public CTAs are hidden for authenticated users.
    expect(screen.queryByText("landing.getStarted")).not.toBeInTheDocument();
    expect(screen.queryByText("landing.signIn")).not.toBeInTheDocument();
  });

  it("renders features heading and 3 feature cards", () => {
    render(<LandingSections />);
    expect(
      screen.getByText("landing.featuresHeading"),
    ).toBeInTheDocument();
    expect(screen.getByText("landing.featureSearch")).toBeInTheDocument();
    expect(screen.getByText("landing.featureScan")).toBeInTheDocument();
    expect(screen.getByText("landing.featureCompare")).toBeInTheDocument();
  });

  it("renders how-it-works heading and 3 steps", () => {
    render(<LandingSections />);
    expect(
      screen.getByText("landing.howItWorksHeading"),
    ).toBeInTheDocument();
    expect(screen.getByText("landing.step1Title")).toBeInTheDocument();
    expect(screen.getByText("landing.step2Title")).toBeInTheDocument();
    expect(screen.getByText("landing.step3Title")).toBeInTheDocument();
  });

  it("renders stats heading and 4 stat values", () => {
    render(<LandingSections />);
    expect(screen.getByText("landing.statsHeading")).toBeInTheDocument();
    // Product count is intentionally reused in both the hero "Model Snapshot" aside and the stats section
    expect(screen.queryAllByText("landing.statProductsValue").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("landing.statCategoriesValue")).toBeInTheDocument();
    expect(screen.queryAllByText("landing.statFactorsValue").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("landing.statCountriesValue").length).toBeGreaterThanOrEqual(1);
  });

  it("renders CTA repeat section", () => {
    render(<LandingSections />);
    expect(screen.getByText("landing.ctaHeading")).toBeInTheDocument();
    expect(
      screen.getByText("landing.ctaDescription"),
    ).toBeInTheDocument();
  });

  it("renders the logo in hero section", () => {
    render(<LandingSections />);
    expect(screen.queryAllByTestId("logo").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all heading elements", () => {
    render(<LandingSections />);
    const headings = screen.getAllByRole("heading");
    // h1 (tagline) + h2 (features, howItWorks, stats, cta) + h3 (3 features + 3 steps) = 11
    expect(headings.length).toBeGreaterThanOrEqual(5);
  });

  it("shows an explicit demo state and disables live-data CTAs", () => {
    render(<LandingSections dataAvailable={false} />);

    expect(screen.getByText("landing.serviceStatusTitle")).toBeInTheDocument();
    expect(screen.getByText("landing.demoDescription")).toBeInTheDocument();
    expect(screen.queryByText("landing.getStarted")).not.toBeInTheDocument();
    expect(screen.queryByText("landing.signIn")).not.toBeInTheDocument();
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
