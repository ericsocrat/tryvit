import { queryKeys } from "@/lib/query-keys";
import type { DashboardData, DashboardInsights } from "@/lib/types";
import { useLanguageStore } from "@/stores/language-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetDashboardData = vi.fn();
const mockGetCategoryOverview = vi.fn();
const mockGetDashboardInsights = vi.fn();
const mockGetUser = vi.fn();
const mockUseAlternativesV2 = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@/lib/api", () => ({
  getDashboardData: (...args: unknown[]) => mockGetDashboardData(...args),
  getCategoryOverview: (...args: unknown[]) => mockGetCategoryOverview(...args),
  getDashboardInsights: (...args: unknown[]) => mockGetDashboardInsights(...args),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, className, "data-testid": testId }: {
    href: string; children: ReactNode; className?: string; "data-testid"?: string;
  }) => <a href={href} className={className} data-testid={testId}>{children}</a>,
}));
vi.mock("@/hooks/use-alternatives-v2", () => ({
  useAlternativesV2: (...args: unknown[]) => mockUseAlternativesV2(...args),
}));

const mockDashboard: DashboardData = {
  api_version: "1.0",
  recently_viewed: [
    { product_id: 1, product_name: "Lay's Classic", brand: "Lay's", category: "chips", country: "PL",
      unhealthiness_score: 65, nutri_score_label: "D", viewed_at: "2026-09-03T12:00:00.000Z", image_thumb_url: null },
    { product_id: 2, product_name: "Pepsi Max", brand: "Pepsi", category: "drinks", country: "PL",
      unhealthiness_score: 30, nutri_score_label: "B", viewed_at: "2026-09-02T12:00:00.000Z", image_thumb_url: null },
  ],
  favorites_preview: [
    { product_id: 3, product_name: "Activia Natural", brand: "Danone", category: "dairy", country: "PL",
      unhealthiness_score: 15, nutri_score_label: "A", added_at: "2026-09-01T12:00:00.000Z", image_thumb_url: null },
  ],
  new_products: [],
  stats: { total_scanned: 42, total_viewed: 15, lists_count: 3, favorites_count: 7, most_viewed_category: "chips" },
};

function emptyDashboard(): DashboardData {
  return {
    api_version: "1.0", recently_viewed: [], favorites_preview: [], new_products: [],
    stats: { total_scanned: 0, total_viewed: 0, lists_count: 2, favorites_count: 0, most_viewed_category: null },
  };
}
const mockInsights: DashboardInsights = {
  api_version: "1.0", avg_score: 0, score_trend: "stable", nova_distribution: {},
  category_diversity: { explored: 0, total: 20 }, allergen_alerts: { count: 0, products: [] }, recent_comparisons: [],
};

import DashboardPage from "./page";

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}><DashboardPage /></QueryClientProvider>,
  );
  return { ...result, queryClient };
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLanguageStore.getState().reset();
    mockGetDashboardData.mockResolvedValue({ ok: true, data: mockDashboard });
    mockGetCategoryOverview.mockResolvedValue({ ok: true, data: [] });
    mockGetDashboardInsights.mockResolvedValue({ ok: true, data: mockInsights });
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { full_name: "Jan Kowalski" } } } });
    mockUseAlternativesV2.mockReturnValue({ data: { alternatives: [] }, isLoading: false });
  });

  it("announces loading before displaying personal content", () => {
    mockGetDashboardData.mockReturnValue(new Promise(() => {}));
    renderDashboard();
    expect(screen.getByRole("status", { name: "Loading your dashboard" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("returning-dashboard")).not.toBeInTheDocument();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("renders one named heading and a preferences link", async () => {
    renderDashboard();
    await screen.findByRole("heading", { level: 1, name: "Welcome back, Jan Kowalski." });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Your preferences" })).toHaveAttribute("href", "/app/settings");
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it("keeps history available when the optional name request rejects", async () => {
    mockGetUser.mockRejectedValue(new Error("Identity refresh unavailable"));
    renderDashboard();
    await screen.findByTestId("returning-dashboard");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back.");
    expect(screen.getByRole("link", { name: /Lay's Classic/ })).toHaveAttribute("href", "/app/product/1");
    expect(screen.queryByTestId("dashboard-error")).not.toBeInTheDocument();
  });

  it("uses alternate name metadata when the full name is absent", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { name: "Jan" } } } });
    renderDashboard();
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome back, Jan." })).toBeVisible();
  });

  it.each([0, 2])("keeps a first-use account with %i empty system lists on the welcome screen", async (listsCount) => {
    const dashboard = emptyDashboard();
    dashboard.stats.lists_count = listsCount;
    mockGetDashboardData.mockResolvedValue({ ok: true, data: dashboard });
    renderDashboard();
    await screen.findByTestId("new-user-welcome");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Start with what you eat.");
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockGetCategoryOverview).not.toHaveBeenCalled();
    expect(mockGetDashboardInsights).not.toHaveBeenCalled();
  });

  it("offers working scan, search, browse and label-guide entries to new users", async () => {
    mockGetDashboardData.mockResolvedValue({ ok: true, data: emptyDashboard() });
    renderDashboard();
    await screen.findByTestId("new-user-welcome");
    expect(screen.getByTestId("new-user-search-cta")).toHaveAttribute("href", "/app/search");
    expect(screen.getByTestId("new-user-scan-cta")).toHaveAttribute("href", "/app/scan");
    expect(screen.getByTestId("new-user-browse-cta")).toHaveAttribute("href", "/app/categories");
    expect(screen.getByRole("link", { name: "Explore the guides" })).toHaveAttribute("href", "/learn");
    expect(screen.getByText("An unknown value does not mean zero.", { exact: false })).toBeVisible();
  });

  it("does not mistake catalog additions for personal activity", async () => {
    const dashboard = emptyDashboard();
    dashboard.new_products = [{ ...mockDashboard.recently_viewed[0], product_id: 4 }];
    mockGetDashboardData.mockResolvedValue({ ok: true, data: dashboard });
    renderDashboard();
    expect(await screen.findByTestId("new-user-welcome")).toBeVisible();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("shows saved favorites without any scan or view history", async () => {
    const dashboard = emptyDashboard();
    dashboard.favorites_preview = mockDashboard.favorites_preview;
    dashboard.stats.favorites_count = 1;
    mockGetDashboardData.mockResolvedValue({ ok: true, data: dashboard });
    renderDashboard();
    await screen.findByTestId("returning-dashboard");
    expect(screen.getByRole("link", { name: /Activia Natural/ })).toHaveAttribute("href", "/app/product/3");
    expect(screen.getByText("1 favorite")).toBeVisible();
    expect(screen.getByText("Your next find starts here.")).toBeVisible();
    expect(screen.queryByTestId("new-user-welcome")).not.toBeInTheDocument();
  });

  it("treats an available favorite preview as content independently of the saved count", async () => {
    const dashboard = emptyDashboard();
    dashboard.favorites_preview = mockDashboard.favorites_preview;
    mockGetDashboardData.mockResolvedValue({ ok: true, data: dashboard });
    renderDashboard();
    await screen.findByTestId("returning-dashboard");
    expect(screen.getByTestId("dashboard-favorite-item")).toHaveAttribute("href", "/app/product/3");
  });

  it("preserves access to counted favorites when the preview is unavailable", async () => {
    const dashboard = emptyDashboard();
    dashboard.stats.favorites_count = 3;
    mockGetDashboardData.mockResolvedValue({ ok: true, data: dashboard });
    renderDashboard();
    await screen.findByTestId("returning-dashboard");
    expect(screen.getByText("Open your lists to see your saved favorites.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open lists" })).toHaveAttribute("href", "/app/lists");
  });

  it("shows collections for a custom-list account with no other history", async () => {
    const dashboard = emptyDashboard();
    dashboard.stats.lists_count = 3;
    mockGetDashboardData.mockResolvedValue({ ok: true, data: dashboard });
    renderDashboard();
    await screen.findByTestId("returning-dashboard");
    expect(screen.getByText("3 lists")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open lists" })).toHaveAttribute("href", "/app/lists");
    expect(screen.queryByTestId("new-user-welcome")).not.toBeInTheDocument();
  });

  it.each(["total_scanned", "total_viewed"] as const)("keeps a useful empty-recent state with %s history", async (stat) => {
    const dashboard = emptyDashboard();
    dashboard.stats[stat] = 1;
    mockGetDashboardData.mockResolvedValue({ ok: true, data: dashboard });
    renderDashboard();
    await screen.findByTestId("returning-dashboard");
    const recent = screen.getByTestId("recently-viewed-compact");
    expect(within(recent).getByText("Your next find starts here.")).toBeVisible();
    expect(within(recent).getByRole("link", { name: "Search products" })).toHaveAttribute("href", "/app/search");
    expect(screen.queryByTestId("recently-viewed-item")).not.toBeInTheDocument();
  });

  it("renders real products, favorites and saved-comparison routes", async () => {
    renderDashboard();
    await screen.findByTestId("returning-dashboard");
    expect(screen.getAllByTestId("recently-viewed-item")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Lay's Classic/ })).toHaveAttribute("href", "/app/product/1");
    expect(screen.getByRole("link", { name: /Pepsi Max/ })).toHaveAttribute("href", "/app/product/2");
    expect(screen.getByRole("link", { name: /Activia Natural/ })).toHaveAttribute("href", "/app/product/3");
    expect(screen.getByRole("link", { name: "Compare products" })).toHaveAttribute("href", "/app/compare");
    expect(screen.getByRole("link", { name: "Saved comparisons" })).toHaveAttribute("href", "/app/compare/saved");
    expect(screen.getByRole("link", { name: "How to read the score" })).toHaveAttribute("href", "/learn/tryvit-score");
    expect(screen.getByTestId("dashboard-search-cta")).toHaveAttribute("href", "/app/search");
    expect(screen.getByTestId("dashboard-scan-cta")).toHaveAttribute("href", "/app/scan");
    expect(screen.getByTestId("dashboard-browse-cta")).toHaveAttribute("href", "/app/categories");
    expect(screen.queryByRole("link", { name: "View history" })).not.toBeInTheDocument();
  });

  it("shows an initial error with useful actions and recovers through retry", async () => {
    mockGetDashboardData
      .mockResolvedValueOnce({ ok: false, error: { code: "500", message: "Server error" } })
      .mockResolvedValueOnce({ ok: true, data: mockDashboard });
    renderDashboard();
    expect(await screen.findByRole("alert")).toHaveTextContent("Your dashboard couldn’t load.");
    expect(screen.getByTestId("dashboard-search-cta")).toHaveAttribute("href", "/app/search");
    expect(screen.getByTestId("dashboard-scan-cta")).toHaveAttribute("href", "/app/scan");
    expect(screen.getByTestId("dashboard-browse-cta")).toHaveAttribute("href", "/app/categories");
    expect(mockGetUser).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("returning-dashboard")).toBeVisible();
    expect(screen.queryByTestId("dashboard-error")).not.toBeInTheDocument();
    expect(mockGetDashboardData).toHaveBeenCalledTimes(2);
  });

  it("keeps cached history after failed refresh and lets the user retry", async () => {
    const { queryClient } = renderDashboard();
    await screen.findByTestId("returning-dashboard");
    mockGetDashboardData.mockResolvedValueOnce({ ok: false, error: { code: "500", message: "Refresh error" } });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("The last loaded information is still shown.");
    expect(screen.getByRole("link", { name: /Lay's Classic/ })).toBeVisible();
    expect(screen.getByTestId("dashboard-collections")).toBeVisible();
    expect(queryClient.getQueryData(queryKeys.dashboard)).toEqual(mockDashboard);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByTestId("returning-dashboard")).toBeVisible();
    expect(mockGetDashboardData).toHaveBeenCalledTimes(3);
  });

  it("keeps category failure local and retries only the category request", async () => {
    mockGetCategoryOverview
      .mockResolvedValueOnce({ ok: false, error: { message: "Categories unavailable" } })
      .mockResolvedValueOnce({ ok: true, data: [{ category: "Dairy", slug: "dairy", display_name: "Dairy" }] });
    renderDashboard();
    await screen.findByTestId("returning-dashboard");
    const categories = screen.getByRole("region", { name: "Categories" });
    expect(await within(categories).findByText(/Categories couldn’t load/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Lay's Classic/ })).toBeVisible();
    expect(screen.getByTestId("dashboard-collections")).toBeVisible();
    await userEvent.click(within(categories).getByRole("button", { name: "Retry" }));
    expect(await within(categories).findByRole("link", { name: "Dairy" })).toHaveAttribute("href", "/app/categories/dairy");
    expect(mockGetCategoryOverview).toHaveBeenCalledTimes(2);
    expect(mockGetDashboardData).toHaveBeenCalledTimes(1);
  });

  it("keeps the first-use dashboard and retry available after a failed background refresh", async () => {
    const empty = emptyDashboard();
    mockGetDashboardData.mockResolvedValue({ ok: true, data: empty });
    const { queryClient } = renderDashboard();
    await screen.findByTestId("new-user-welcome");
    mockGetDashboardData.mockResolvedValueOnce({ ok: false, error: { code: "500", message: "Refresh error" } });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("The last loaded information is still shown.");
    expect(screen.getByTestId("new-user-welcome")).toBeVisible();
    expect(screen.getByTestId("new-user-search-cta")).toHaveAttribute("href", "/app/search");
    expect(queryClient.getQueryData(queryKeys.dashboard)).toEqual(empty);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByTestId("new-user-welcome")).toBeVisible();
    expect(mockGetDashboardData).toHaveBeenCalledTimes(3);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("keeps allergen-check failure separate from the loaded dashboard", async () => {
    mockGetDashboardInsights.mockRejectedValue(new Error("Saved evidence unavailable"));
    renderDashboard();
    await screen.findByTestId("returning-dashboard");
    expect(await screen.findByText(/We couldn’t check your saved allergen matches/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Lay's Classic/ })).toBeVisible();
    expect(screen.getByTestId("dashboard-start")).toBeVisible();
    expect(screen.queryByTestId("dashboard-error")).not.toBeInTheDocument();
  });

  it("does not mount swap suggestions or replaced health and nutrition panels", async () => {
    renderDashboard();
    await screen.findByTestId("returning-dashboard");
    await waitFor(() => expect(mockGetDashboardInsights).toHaveBeenCalledTimes(1));
    expect(mockUseAlternativesV2).not.toHaveBeenCalled();
    expect(screen.queryByTestId("quick-win-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("health-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("health-insights-panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Tip of the Day")).not.toBeInTheDocument();
  });
});
