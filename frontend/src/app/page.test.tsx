import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage, { metadata } from "./page";

// ─── i18n translations map ──────────────────────────────────────────────────

const tMap: Record<string, string> = {
  "landing.tagline": "healthier choices, made simple",
  "landing.description":
    "Search, scan, and compare food products in Poland and Germany. Get instant health scores, allergen warnings, and better alternatives.",
  "landing.getStarted": "Get started",
  "landing.signIn": "Sign in",
  "landing.demoMode": "Demo mode",
  "landing.demoDescription":
    "Explore the scoring approach. Live data features are paused.",
  "landing.serviceStatusTitle":
    "The TryVit website is available; live data features are paused",
  "landing.serviceStatusDescription": "Live data will return after readiness checks.",
  "landing.applicationStatus": "Website",
  "landing.dataStatus": "Data backend",
  "landing.productReadiness": "Product readiness",
  "landing.available": "Available",
  "landing.paused": "Paused",
  "landing.demoOnly": "Demo only",
  "landing.viewStatus": "View service status",
  "landing.liveMetrics": "Live catalog metrics update.",
  "landing.demoMetrics": "Catalog metrics will return after readiness checks.",
  "landing.readyLabel": "Ready when you are",
  "landing.demoCtaHeading": "Explore TryVit in demo mode",
  "landing.demoCtaDescription": "Live catalog and account features are paused.",
  "landing.featuresHeading": "Everything you need to eat healthier",
  "landing.featureSearch": "Search",
  "landing.featureSearchDesc":
    "Find products by name, brand, or category",
  "landing.featureScan": "Scan",
  "landing.featureScanDesc": "Scan barcodes for instant product info",
  "landing.featureCompare": "Compare",
  "landing.featureCompareDesc":
    "See health scores and find better alternatives",
  "landing.howItWorksHeading": "How it works",
  "landing.step1Title": "Search or scan",
  "landing.step1Desc":
    "Find any product by name, brand, or barcode scan.",
  "landing.step2Title": "Get your score",
  "landing.step2Desc":
    "See a clear 1–100 health score based on 9 nutrition factors.",
  "landing.step3Title": "Find better",
  "landing.step3Desc":
    "Discover healthier alternatives in the same category.",
  "landing.statsHeading": "Trusted data you can rely on",
  "landing.statProducts": "Live catalog",
  "landing.statCategories": "Food categories",
  "landing.statFactors": "Scoring factors",
  "landing.statCountries": "Countries covered",
  "landing.ctaHeading": "Ready to eat healthier?",
  "landing.ctaDescription":
    "Join TryVit and make informed food choices backed by real nutrition data.",
  "landing.statProductsValue": "In validation",
  "landing.statCategoriesValue": "25",
  "landing.statFactorsValue": "9",
  "landing.statCountriesValue": "2",
};

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => tMap[key] ?? key,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/common/Logo", () => ({
  Logo: (props: { variant?: string; size?: number }) => (
    <span data-testid="logo" data-variant={props.variant} />
  ),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

vi.mock("@/components/layout/Footer", () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-service-key");
  vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Hero section ───────────────────────────────────────────────────────────

describe("HomePage — Hero section", () => {
  it("renders the main heading with tagline", () => {
    render(<HomePage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/healthier/);
    expect(heading).toHaveTextContent(/made simple/);
  });

  it("renders the description", () => {
    render(<HomePage />);
    expect(
      screen.getByText(/Search, scan, and compare food products/),
    ).toBeInTheDocument();
  });

  it("renders Logo icon in the hero", () => {
    render(<HomePage />);
    const logos = screen.queryAllByTestId("logo");
    expect(logos.some((logo) => logo.getAttribute("data-variant") === "icon")).toBe(true);
  });

  it("renders Get started CTA linking to signup", () => {
    render(<HomePage />);
    const ctas = screen.getAllByText("Get started");
    expect(ctas[0].closest("a")).toHaveAttribute("href", "/auth/signup");
  });

  it("renders Sign in link to login", () => {
    render(<HomePage />);
    const links = screen.queryAllByText("Sign in");
    expect(links.some((link) => link.getAttribute("href") === "/auth/login")).toBe(true);
  });

  it("shows demo mode and removes live CTAs when the backend is unavailable", () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "demo");
    const { container } = render(<HomePage />);

    expect(
      screen.getByText("The TryVit website is available; live data features are paused"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Get started")).not.toBeInTheDocument();
    expect(screen.getAllByText("In validation").length).toBeGreaterThanOrEqual(2);
    const structuredData = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')!.textContent!,
    );
    expect(structuredData.potentialAction).toBeUndefined();
  });
});

// ─── Features section ───────────────────────────────────────────────────────

describe("HomePage — Features section", () => {
  it("renders feature section heading", () => {
    render(<HomePage />);
    expect(
      screen.getByText("Everything you need to eat healthier"),
    ).toBeInTheDocument();
  });

  it("renders three feature highlights", () => {
    render(<HomePage />);
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Scan")).toBeInTheDocument();
    expect(screen.getByText("Compare")).toBeInTheDocument();
  });

  it("renders feature descriptions", () => {
    render(<HomePage />);
    expect(
      screen.getByText("Find products by name, brand, or category"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Scan barcodes for instant product info"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("See health scores and find better alternatives"),
    ).toBeInTheDocument();
  });

  it("renders feature icons as SVGs", () => {
    const { container } = render(<HomePage />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── How It Works section ───────────────────────────────────────────────────

describe("HomePage — How It Works section", () => {
  it("renders How It Works heading", () => {
    render(<HomePage />);
    expect(screen.getByText("How it works")).toBeInTheDocument();
  });

  it("renders three numbered steps", () => {
    render(<HomePage />);
    expect(screen.getByText("Search or scan")).toBeInTheDocument();
    expect(screen.getByText("Get your score")).toBeInTheDocument();
    expect(screen.getByText("Find better")).toBeInTheDocument();
  });

  it("renders step descriptions", () => {
    render(<HomePage />);
    expect(
      screen.getByText(/Find any product by name, brand, or barcode/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/clear 1–100 health score/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/healthier alternatives in the same category/),
    ).toBeInTheDocument();
  });

  it("renders step numbers 1, 2, 3", () => {
    render(<HomePage />);
    expect(screen.getByText("1")).toBeInTheDocument();
    // "2" appears both as step number and stat value — verify at least 2 instances
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

// ─── Data Stats section ─────────────────────────────────────────────────────

describe("HomePage — Data Stats section", () => {
  it("renders stats heading", () => {
    render(<HomePage />);
    expect(
      screen.getByText("Trusted data you can rely on"),
    ).toBeInTheDocument();
  });

  it("renders four stat values", () => {
    render(<HomePage />);
    // Product count is intentionally reused in both the hero "Model Snapshot" aside and the stats section
    expect(screen.queryAllByText(tMap["landing.statProductsValue"]).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(tMap["landing.statCategoriesValue"])).toBeInTheDocument();
    expect(screen.queryAllByText(tMap["landing.statFactorsValue"]).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText(tMap["landing.statCountriesValue"]).length).toBeGreaterThanOrEqual(1);
  });

  it("renders stat labels", () => {
    render(<HomePage />);
    expect(screen.getByText("Live catalog")).toBeInTheDocument();
    expect(screen.getByText("Food categories")).toBeInTheDocument();
    expect(screen.getByText("Scoring factors")).toBeInTheDocument();
    expect(screen.getByText("Countries covered")).toBeInTheDocument();
  });
});

// ─── CTA Repeat section ─────────────────────────────────────────────────────

describe("HomePage — CTA Repeat section", () => {
  it("renders CTA heading", () => {
    render(<HomePage />);
    expect(
      screen.getByText("Ready to eat healthier?"),
    ).toBeInTheDocument();
  });

  it("renders CTA description", () => {
    render(<HomePage />);
    expect(
      screen.getByText(/informed food choices backed by real nutrition/),
    ).toBeInTheDocument();
  });

  it("renders second Get started CTA linking to signup", () => {
    render(<HomePage />);
    const ctas = screen.getAllByText("Get started");
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    expect(ctas[1].closest("a")).toHaveAttribute("href", "/auth/signup");
  });
});

// ─── Layout composition ─────────────────────────────────────────────────────

describe("HomePage — Layout", () => {
  it("includes Header component", () => {
    render(<HomePage />);
    expect(screen.getByTestId("header")).toBeInTheDocument();
  });

  it("includes Footer component", () => {
    render(<HomePage />);
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("has a main content landmark", () => {
    render(<HomePage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders accessible section headings", () => {
    render(<HomePage />);
    const h2s = screen.getAllByRole("heading", { level: 2 });
    // Features, How It Works, Stats, CTA = 4 h2 headings
    expect(h2s.length).toBe(4);
  });
});

// ─── SEO metadata export ────────────────────────────────────────────────────

describe("HomePage — SEO metadata", () => {
  it("exports page-level metadata with title", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("TryVit — Know What You Eat");
  });

  it("exports metadata without an unverified live product-count claim", () => {
    expect(metadata.description).toContain("service availability");
    expect(metadata.description).not.toMatch(/2[,. ]400\+/);
  });

  it("exports openGraph metadata with type website", () => {
    const og = metadata.openGraph as Record<string, unknown>;
    expect(og).toBeDefined();
    expect(og.type).toBe("website");
    expect(og.title).toBe("TryVit — Know What You Eat");
  });

  it("exports twitter card metadata", () => {
    const tw = metadata.twitter as Record<string, unknown>;
    expect(tw).toBeDefined();
    expect(tw.card).toBe("summary_large_image");
  });
});

// ─── JSON-LD structured data ────────────────────────────────────────────────

describe("HomePage — JSON-LD", () => {
  it("renders a WebSite JSON-LD script tag", () => {
    const { container } = render(<HomePage />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const jsonLd = JSON.parse(script!.textContent!);
    expect(jsonLd["@type"]).toBe("WebSite");
    expect(jsonLd.name).toBe("TryVit");
  });

  it("includes SearchAction in JSON-LD", () => {
    const { container } = render(<HomePage />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const jsonLd = JSON.parse(script!.textContent!);
    expect(jsonLd.potentialAction["@type"]).toBe("SearchAction");
    expect(jsonLd.potentialAction.target.urlTemplate).toContain("/app/search");
  });
});
