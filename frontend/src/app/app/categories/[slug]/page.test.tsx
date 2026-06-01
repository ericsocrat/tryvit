import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CategoryListingPage from "./page";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

let mockSlug = "chips";
vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: mockSlug }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const mockGetCategoryListing = vi.fn();
const mockGetCategoryOverview = vi.fn();
vi.mock("@/lib/api", () => ({
  getCategoryListing: (...args: unknown[]) => mockGetCategoryListing(...args),
  getCategoryOverview: (...args: unknown[]) => mockGetCategoryOverview(...args),
}));

vi.mock("@/components/common/skeletons", () => ({
  CategoryListingSkeleton: () => (
    <div data-testid="skeleton" role="status" aria-busy="true" />
  ),
}));

// Stub child components
vi.mock("@/components/common/NutriScoreBadge", () => ({
  NutriScoreBadge: ({ grade }: { grade: string | null }) => {
    const display = grade?.toUpperCase() ?? "?";
    const label = ["A", "B", "C", "D", "E"].includes(display)
      ? display
      : "unknown";
    return (
      <span data-testid="nutri-score-badge" aria-label={`Nutri-Score ${label}`}>
        {display}
      </span>
    );
  },
}));

vi.mock("@/components/product/HealthWarningsCard", () => ({
  HealthWarningBadge: () => <span data-testid="health-badge" />,
}));

vi.mock("@/components/product/AvoidBadge", () => ({
  AvoidBadge: () => <span data-testid="avoid-badge" />,
}));

vi.mock("@/components/product/AddToListMenu", () => ({
  AddToListMenu: () => <span data-testid="add-to-list" />,
}));

vi.mock("@/components/compare/CompareCheckbox", () => ({
  CompareCheckbox: () => <span data-testid="compare-checkbox" />,
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function createWrapper() {
  return Wrapper;
}

const mockProducts = [
  {
    product_id: 1,
    ean: "1234567890123",
    product_name: "Lay's Classic",
    brand: "Lay's",
    unhealthiness_score: 72,
    score_band: "high" as const,
    nutri_score: "D" as const,
    nova_group: "4",
    processing_risk: "high",
    calories: 536,
    total_fat_g: 33,
    protein_g: 6,
    sugars_g: 1,
    salt_g: 1.3,
    high_salt_flag: true,
    high_sugar_flag: false,
    high_sat_fat_flag: true,
    confidence: "high",
    data_completeness_pct: 95,
  },
  {
    product_id: 2,
    ean: "2345678901234",
    product_name: "Pringles Original",
    brand: "Pringles",
    unhealthiness_score: 65,
    score_band: "moderate" as const,
    nutri_score: "C" as const,
    nova_group: "4",
    processing_risk: "high",
    calories: 520,
    total_fat_g: 32,
    protein_g: 4,
    sugars_g: 2,
    salt_g: 1.8,
    high_salt_flag: true,
    high_sugar_flag: false,
    high_sat_fat_flag: false,
    confidence: "high",
    data_completeness_pct: 90,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockSlug = "chips";
  mockGetCategoryListing.mockResolvedValue({
    ok: true,
    data: {
      total_count: 2,
      products: mockProducts,
    },
  });
  // Default overview: a valid "chips" category so the page renders normally.
  // display_name matches formatSlug("chips") to keep heading/breadcrumb assertions stable.
  mockGetCategoryOverview.mockResolvedValue({
    ok: true,
    data: [
      {
        country_code: "PL",
        category: "Chips",
        slug: "chips",
        display_name: "chips",
        category_description: null,
        icon_emoji: "🥔",
        sort_order: 1,
        product_count: 2,
        avg_score: 50,
        min_score: 10,
        max_score: 80,
        median_score: 45,
        pct_nutri_a_b: 20,
        pct_nova_4: 75,
      },
    ],
  });
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("CategoryListingPage", () => {
  it("renders category title from slug", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "chips" }),
      ).toBeInTheDocument();
    });
  });

  it("shows total product count", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("2 products")).toBeInTheDocument();
    });
  });

  it("renders breadcrumb navigation with Dashboard, Categories, and slug", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    const nav = screen.getByLabelText("Breadcrumb");
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByText("Dashboard")[0].closest("a")).toHaveAttribute(
      "href",
      "/app",
    );
    expect(screen.getAllByText("Categories")[0].closest("a")).toHaveAttribute(
      "href",
      "/app/categories",
    );
    await waitFor(() => {
      expect(
        screen.getByText("chips", { selector: "[aria-current='page']" }),
      ).toBeInTheDocument();
    });
  });

  it("shows skeleton loading state while fetching", () => {
    mockGetCategoryListing.mockReturnValue(new Promise(() => {}));
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    mockGetCategoryListing.mockResolvedValue({
      ok: false,
      error: { message: "Server err" },
    });
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(
        screen.getByText("Failed to load categories."),
      ).toBeInTheDocument();
    });
  });

  it("shows retry button on error", async () => {
    mockGetCategoryListing.mockResolvedValue({
      ok: false,
      error: { message: "Server err" },
    });
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });
  });

  it("shows empty state when no products", async () => {
    mockGetCategoryListing.mockResolvedValue({
      ok: true,
      data: { total_count: 0, products: [] },
    });
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(
        screen.getByText("No products in this category."),
      ).toBeInTheDocument();
    });
  });

  it("renders category stats with score bar on the consumer-facing TryVit scale", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });

    // Stats card range text uses TryVit (100 - raw): max_score 80 → 20, min_score 10 → 90.
    await waitFor(() => {
      expect(screen.getByText("20–90")).toBeInTheDocument();
    });

    // Score bar aria-label uses the same TryVit scale (ascending), not raw 10/80.
    const bar = screen.getByRole("img", { name: "Score range 20 to 90" });
    expect(bar).toBeInTheDocument();
  });

  it("shows a not-found state for an unknown/stale category slug", async () => {
    mockSlug = "chips-pl"; // not present in the overview list
    render(<CategoryListingPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Category not found")).toBeInTheDocument();
    });
    // Action links back to the categories index.
    expect(
      screen.getByText("Browse all categories").closest("a"),
    ).toHaveAttribute("href", "/app/categories");
    // It must NOT fall back to the generic "no products" empty state.
    expect(
      screen.queryByText("No products in this category."),
    ).not.toBeInTheDocument();
  });

  it("shows the no-products state for a valid category with zero products", async () => {
    mockGetCategoryListing.mockResolvedValue({
      ok: true,
      data: { total_count: 0, products: [] },
    });
    render(<CategoryListingPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByText("No products in this category."),
      ).toBeInTheDocument();
    });
    // A valid category must NOT render the not-found state.
    expect(screen.queryByText("Category not found")).not.toBeInTheDocument();
  });

  it("renders product rows with names and brands", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Lay's Classic")).toBeInTheDocument();
    });
    expect(screen.getByText("Pringles Original")).toBeInTheDocument();
  });

  it("shows health warning flags in detailed view", async () => {
    const user = userEvent.setup();
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Lay's Classic")).toBeInTheDocument();
    });
    // Switch to detailed view to see health flags
    await user.click(screen.getByText("Detailed"));
    await waitFor(() => {
      // Both products have high_salt_flag so multiple elements
      expect(screen.getAllByText("High salt")).toHaveLength(2);
    });
    expect(screen.getByText("High sat. fat")).toBeInTheDocument();
  });

  it("renders sort controls", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    // Default sort
    expect(screen.getByText("↑ Asc")).toBeInTheDocument();
  });

  it("toggles sort direction", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    const user = userEvent.setup();

    await user.click(screen.getByText("↑ Asc"));
    expect(screen.getByText("↓ Desc")).toBeInTheDocument();
  });

  it("links product rows to detail pages", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Lay's Classic")).toBeInTheDocument();
    });
    const link = screen.getByText("Lay's Classic").closest("a");
    expect(link).toHaveAttribute("href", "/app/product/1");
  });

  it("does not show pagination for single page", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Lay's Classic")).toBeInTheDocument();
    });
    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("shows pagination when multiple pages", async () => {
    mockGetCategoryListing.mockResolvedValue({
      ok: true,
      data: {
        total_count: 45,
        products: mockProducts,
      },
    });
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Previous")).toBeInTheDocument();
    });
    expect(screen.getByText("Next →")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("renders product score badges", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("28")).toBeInTheDocument();
    });
    expect(screen.getByText("35")).toBeInTheDocument();
  });

  it("renders nutri-score badges", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("D")).toBeInTheDocument();
    });
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("uses singular 'product' for count of 1", async () => {
    mockGetCategoryListing.mockResolvedValue({
      ok: true,
      data: {
        total_count: 1,
        products: [mockProducts[0]],
      },
    });
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("1 product")).toBeInTheDocument();
    });
  });

  it("renders child component badges per row in detailed view", async () => {
    const user = userEvent.setup();
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Lay's Classic")).toBeInTheDocument();
    });
    // Switch to detailed view to see all badges
    await user.click(screen.getByText("Detailed"));
    await waitFor(() => {
      expect(screen.getAllByTestId("health-badge")).toHaveLength(2);
    });
    expect(screen.getAllByTestId("avoid-badge")).toHaveLength(2);
    expect(screen.getAllByTestId("compare-checkbox")).toHaveLength(2);
  });

  // ─── View Mode Tests ──────────────────────────────────────────────────────

  it("defaults to compact view", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Lay's Classic")).toBeInTheDocument();
    });
    // Compact view: names shown, but no health flags
    expect(screen.queryByText("High salt")).not.toBeInTheDocument();
    // Toggle button should offer switching to "Detailed"
    expect(screen.getByText("Detailed")).toBeInTheDocument();
  });

  it("shows compact rows without health flags or action buttons", async () => {
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Lay's Classic")).toBeInTheDocument();
    });
    // In compact mode, child badges are not rendered
    expect(screen.queryByTestId("health-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("avoid-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("compare-checkbox")).not.toBeInTheDocument();
    // But score and NutriScore are still visible
    expect(screen.getByText("28")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("toggles from compact to detailed view", async () => {
    const user = userEvent.setup();
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Lay's Classic")).toBeInTheDocument();
    });
    // Click toggle button
    await user.click(screen.getByText("Detailed"));
    // Now detailed elements should appear
    await waitFor(() => {
      expect(screen.getAllByText("High salt")).toHaveLength(2);
    });
    // Button should now offer switching back to "Compact"
    expect(screen.getByText("Compact")).toBeInTheDocument();
  });

  it("persists view mode preference in localStorage", async () => {
    const user = userEvent.setup();
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Lay's Classic")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Detailed"));
    expect(localStorage.getItem("tryvit:category-view-mode")).toBe("detailed");
  });

  it("restores detailed view from localStorage", async () => {
    localStorage.setItem("tryvit:category-view-mode", "detailed");
    render(<CategoryListingPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Lay's Classic")).toBeInTheDocument();
    });
    // Detailed view restored — health flags visible
    await waitFor(() => {
      expect(screen.getAllByText("High salt")).toHaveLength(2);
    });
    // Toggle shows "Compact" option
    expect(screen.getByText("Compact")).toBeInTheDocument();
  });
});
