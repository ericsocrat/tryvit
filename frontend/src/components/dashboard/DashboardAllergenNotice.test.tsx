import { queryKeys } from "@/lib/query-keys";
import type { DashboardInsights } from "@/lib/types";
import { useLanguageStore } from "@/stores/language-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardAllergenNotice } from "./DashboardAllergenNotice";

const mockGetDashboardInsights = vi.fn();
vi.mock("@/lib/api", () => ({
  getDashboardInsights: (...args: unknown[]) => mockGetDashboardInsights(...args),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const insights: DashboardInsights = {
  api_version: "1.0",
  avg_score: 35,
  score_trend: "stable",
  nova_distribution: { "1": 3 },
  category_diversity: { explored: 2, total: 20 },
  recent_comparisons: [],
  allergen_alerts: {
    count: 2,
    products: [
      { product_id: 1, product_name: "Cereal", allergen: "en:gluten" },
      { product_id: 1, product_name: "Cereal", allergen: "milk" },
      { product_id: 2, product_name: "Bread", allergen: "gluten" },
    ],
  },
};

function renderNotice(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const result = render(
    <QueryClientProvider client={queryClient}>
      <DashboardAllergenNotice />
      <a href="/app/search">Search products</a>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

describe("DashboardAllergenNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLanguageStore.getState().reset();
  });

  it("announces loading without blocking other dashboard actions", () => {
    mockGetDashboardInsights.mockReturnValue(new Promise(() => {}));
    renderNotice();
    expect(screen.getByRole("status")).toHaveTextContent("Checking your saved allergen matches");
    expect(screen.getByRole("link", { name: "Search products" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows actual matches, localized deduplicated allergens and the limited scope", async () => {
    mockGetDashboardInsights.mockResolvedValue({ ok: true, data: insights });
    const { queryClient } = renderNotice();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("2 products in Favorites have recorded matches for allergens you avoid: Gluten, Milk.");
    expect(alert).toHaveTextContent("Source details and traces are not assessed here.");
    expect(screen.getByRole("link", { name: "Review your lists" })).toHaveAttribute("href", "/app/lists");
    expect(queryClient.getQueryData(queryKeys.dashboardInsights)).toEqual(insights);
    expect(screen.queryByText(/score|trend|NOVA/i)).not.toBeInTheDocument();
  });

  it("hides a completed no-match check without claiming safety, including the RPC null-products form", async () => {
    mockGetDashboardInsights.mockResolvedValue({
      ok: true,
      data: { ...insights, allergen_alerts: { count: 0, products: null } },
    });
    renderNotice();
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.queryByTestId("dashboard-allergen-notice")).not.toBeInTheDocument();
    expect(screen.queryByText(/safe|allergen-free|no allergens/i)).not.toBeInTheDocument();
  });

  it("retries an unavailable check and replaces it with the returned matches", async () => {
    mockGetDashboardInsights
      .mockResolvedValueOnce({ ok: false, error: { message: "Preferences unavailable" } })
      .mockResolvedValueOnce({ ok: true, data: insights });
    renderNotice();
    expect(await screen.findByRole("status")).toHaveTextContent("Checking your saved allergen matches");
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(screen.getByRole("status")).toHaveTextContent("We couldn’t check");
    await userEvent.click(retry);
    expect(await screen.findByRole("alert")).toHaveTextContent("Gluten, Milk");
    expect(mockGetDashboardInsights).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it.each([
    undefined,
    { count: -1, products: [] },
    { count: 1, products: [] },
    { count: 1, products: [{ allergen: "" }] },
  ])("shows unavailable evidence for an incomplete success payload (%j)", async (alerts) => {
    mockGetDashboardInsights.mockResolvedValue({ ok: true, data: { ...insights, allergen_alerts: alerts } });
    renderNotice();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("We couldn’t check");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps known matches visible when a refresh fails", async () => {
    mockGetDashboardInsights
      .mockResolvedValueOnce({ ok: true, data: insights })
      .mockResolvedValueOnce({ ok: false, error: { message: "Unavailable" } });
    const { queryClient } = renderNotice();
    await screen.findByRole("alert");
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboardInsights });
    });
    expect(await screen.findByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Gluten, Milk");
    expect(screen.getByRole("status")).toHaveTextContent("We couldn’t check");
  });

  it("preserves an unknown returned allergen name instead of displaying a translation key", async () => {
    mockGetDashboardInsights.mockResolvedValue({
      ok: true,
      data: { ...insights, allergen_alerts: { count: 1, products: [{ product_id: 1, product_name: "Food", allergen: "other-allergen" }] } },
    });
    renderNotice();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("other-allergen");
    expect(alert).not.toHaveTextContent("allergens.other-allergen");
  });

  it("rechecks a fresh cache on remount and replaces matches after preference changes", async () => {
    mockGetDashboardInsights.mockResolvedValueOnce({ ok: true, data: insights });
    const { queryClient, unmount } = renderNotice();
    await screen.findByRole("alert");
    unmount();

    const updated = {
      ...insights,
      allergen_alerts: { count: 1, products: [{ product_id: 3, product_name: "Yogurt", allergen: "milk" }] },
    };
    let finishRefresh: (value: unknown) => void = () => {};
    mockGetDashboardInsights.mockReturnValueOnce(new Promise((resolve) => { finishRefresh = resolve; }));
    renderNotice(queryClient);
    await waitFor(() => expect(mockGetDashboardInsights).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status")).toHaveTextContent("Checking your saved allergen matches");
    expect(screen.getByRole("alert")).toHaveTextContent("Gluten, Milk");

    await act(async () => finishRefresh({ ok: true, data: updated }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("1 product in Favorites has recorded matches for allergens you avoid: Milk."));
    expect(screen.getByRole("alert")).not.toHaveTextContent("Gluten");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("announces a recheck of cached zero matches instead of silently treating the check as current", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(queryKeys.dashboardInsights, { ...insights, allergen_alerts: { count: 0, products: [] } });
    mockGetDashboardInsights.mockReturnValue(new Promise(() => {}));
    renderNotice(queryClient);
    expect(screen.getByRole("status")).toHaveTextContent("Checking your saved allergen matches");
    expect(mockGetDashboardInsights).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
