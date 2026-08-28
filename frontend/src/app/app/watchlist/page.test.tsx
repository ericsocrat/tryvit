import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WatchlistPage from "./page";

const mockGetWatchlist = vi.fn();

vi.mock("@/lib/api", () => ({
  getWatchlist: (...args: unknown[]) => mockGetWatchlist(...args),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

vi.mock("@/components/product/ScoreTrendChart", () => ({
  ScoreTrendChart: () => <span data-testid="score-trend" />,
}));

function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetWatchlist.mockResolvedValue({
    ok: true,
    data: {
      success: true,
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 1,
    },
  });
});

describe("WatchlistPage", () => {
  it("keeps the empty state distinct from loading and failure", async () => {
    render(<WatchlistPage />, { wrapper: Wrapper });

    expect(screen.getByTestId("watchlist-loading")).toBeInTheDocument();
    expect(await screen.findByText("No watched products")).toBeInTheDocument();
    expect(screen.queryByTestId("watchlist-error")).not.toBeInTheDocument();
  });

  it("renders watched products as provisional product records", async () => {
    mockGetWatchlist.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        items: [
          {
            watch_id: 7,
            product_id: 42,
            alert_threshold: 5,
            watched_since: "2026-08-01T00:00:00Z",
            product_name: "Oat Bar",
            brand: "Example Foods",
            category: "Snacks",
            current_score: 22,
            score_band: "moderate",
            nutri_score: "B",
            nova_group: "3",
            last_delta: 0,
            trend: "stable",
            reformulation_detected: false,
            sparkline: [],
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      },
    });

    render(<WatchlistPage />, { wrapper: Wrapper });

    expect(await screen.findByText("Oat Bar")).toBeInTheDocument();
    expect(screen.getByTestId("product-register-card")).toHaveAttribute(
      "data-evidence-disposition",
      "unavailable",
    );
    expect(screen.getByRole("link", { name: /Oat Bar/i })).toHaveAttribute(
      "href",
      "/app/product/42",
    );
  });

  it("announces an unavailable watchlist and retries non-destructively", async () => {
    mockGetWatchlist.mockResolvedValue({
      ok: false,
      error: { code: "UNAVAILABLE", message: "offline" },
    });
    const user = userEvent.setup();

    render(<WatchlistPage />, { wrapper: Wrapper });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load your watchlist");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mockGetWatchlist).toHaveBeenCalledTimes(2);
  });
});
