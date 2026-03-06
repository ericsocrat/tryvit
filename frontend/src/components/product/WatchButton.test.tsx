import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { WatchButton } from "./WatchButton";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

const mockIsWatchingProduct = vi.fn();
const mockWatchProduct = vi.fn();
const mockUnwatchProduct = vi.fn();

vi.mock("@/lib/api", () => ({
  isWatchingProduct: (...args: unknown[]) => mockIsWatchingProduct(...args),
  watchProduct: (...args: unknown[]) => mockWatchProduct(...args),
  unwatchProduct: (...args: unknown[]) => mockUnwatchProduct(...args),
}));

vi.mock("@/lib/query-keys", () => ({
  queryKeys: {
    isWatching: (id: number) => ["isWatching", id],
    watchlist: () => ["watchlist"],
  },
  staleTimes: { isWatching: 0 },
}));

vi.mock("@/components/common/Icon", () => ({
  Icon: ({ icon: _icon, ...rest }: Record<string, unknown>) => (
    <span data-testid="icon" {...rest} />
  ),
}));

vi.mock("@/components/pwa/NotificationPrompt", () => ({
  NotificationPrompt: ({ onDismiss }: { onDismiss: () => void }) => (
    <div data-testid="notification-prompt">
      <button onClick={onDismiss}>dismiss</button>
    </div>
  ),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WatchButton", () => {
  // ─── Loading State ──────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows loading button while query is pending", () => {
      mockIsWatchingProduct.mockReturnValue(new Promise(() => {})); // never resolves
      render(<WatchButton productId={1} />, { wrapper: createWrapper() });
      expect(screen.getByTestId("watch-button-loading")).toBeInTheDocument();
    });

    it("loading button is disabled", () => {
      mockIsWatchingProduct.mockReturnValue(new Promise(() => {}));
      render(<WatchButton productId={1} />, { wrapper: createWrapper() });
      expect(screen.getByTestId("watch-button-loading")).toBeDisabled();
    });

    it("shows loading text when not compact", () => {
      mockIsWatchingProduct.mockReturnValue(new Promise(() => {}));
      render(<WatchButton productId={1} />, { wrapper: createWrapper() });
      expect(screen.getByText("watchlist.loading")).toBeInTheDocument();
    });

    it("hides loading text when compact", () => {
      mockIsWatchingProduct.mockReturnValue(new Promise(() => {}));
      render(<WatchButton productId={1} compact />, {
        wrapper: createWrapper(),
      });
      expect(screen.queryByText("watchlist.loading")).not.toBeInTheDocument();
    });
  });

  // ─── Not Watching State ─────────────────────────────────────────────

  describe("not watching state", () => {
    beforeEach(() => {
      mockIsWatchingProduct.mockResolvedValue({
        ok: true,
        data: { watching: false },
      });
    });

    it("renders watch button after query resolves", async () => {
      render(<WatchButton productId={1} />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByTestId("watch-button")).toBeInTheDocument();
      });
    });

    it("has aria-pressed=false when not watching", async () => {
      render(<WatchButton productId={1} />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByTestId("watch-button")).toHaveAttribute(
          "aria-pressed",
          "false",
        );
      });
    });

    it("shows watch label", async () => {
      render(<WatchButton productId={1} />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByText("watchlist.watchButton")).toBeInTheDocument();
      });
    });

    it("has correct aria-label", async () => {
      render(<WatchButton productId={1} />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByTestId("watch-button")).toHaveAttribute(
          "aria-label",
          "watchlist.watchButton",
        );
      });
    });
  });

  // ─── Watching State ─────────────────────────────────────────────────

  describe("watching state", () => {
    beforeEach(() => {
      mockIsWatchingProduct.mockResolvedValue({
        ok: true,
        data: { watching: true },
      });
    });

    it("has aria-pressed=true when watching", async () => {
      render(<WatchButton productId={1} />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByTestId("watch-button")).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      });
    });

    it("shows unwatch label", async () => {
      render(<WatchButton productId={1} />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(
          screen.getByText("watchlist.unwatchButton"),
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Watch Mutation ─────────────────────────────────────────────────

  describe("watch mutation", () => {
    beforeEach(() => {
      mockIsWatchingProduct.mockResolvedValue({
        ok: true,
        data: { watching: false },
      });
      mockWatchProduct.mockResolvedValue({ ok: true });
    });

    it("calls watchProduct on click when not watching", async () => {
      const user = userEvent.setup();
      render(<WatchButton productId={42} />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByTestId("watch-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("watch-button"));
      expect(mockWatchProduct).toHaveBeenCalledOnce();
    });

    it("shows notification prompt after successful watch", async () => {
      const user = userEvent.setup();
      render(<WatchButton productId={42} />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByTestId("watch-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("watch-button"));
      await waitFor(() => {
        expect(
          screen.getByTestId("notification-prompt"),
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Unwatch Mutation ───────────────────────────────────────────────

  describe("unwatch mutation", () => {
    beforeEach(() => {
      mockIsWatchingProduct.mockResolvedValue({
        ok: true,
        data: { watching: true },
      });
      mockUnwatchProduct.mockResolvedValue({ ok: true });
    });

    it("calls unwatchProduct on click when watching", async () => {
      const user = userEvent.setup();
      render(<WatchButton productId={42} />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByTestId("watch-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("watch-button"));
      expect(mockUnwatchProduct).toHaveBeenCalledOnce();
    });

    it("does not show notification prompt after unwatch", async () => {
      const user = userEvent.setup();
      render(<WatchButton productId={42} />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByTestId("watch-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("watch-button"));
      await waitFor(() => {
        expect(mockUnwatchProduct).toHaveBeenCalled();
      });
      expect(
        screen.queryByTestId("notification-prompt"),
      ).not.toBeInTheDocument();
    });
  });

  // ─── Compact Mode ──────────────────────────────────────────────────

  describe("compact mode", () => {
    beforeEach(() => {
      mockIsWatchingProduct.mockResolvedValue({
        ok: true,
        data: { watching: false },
      });
    });

    it("hides label text in compact mode", async () => {
      render(<WatchButton productId={1} compact />, {
        wrapper: createWrapper(),
      });
      await waitFor(() => {
        expect(screen.getByTestId("watch-button")).toBeInTheDocument();
      });
      expect(
        screen.queryByText("watchlist.watchButton"),
      ).not.toBeInTheDocument();
    });

    it("shows label text when not compact", async () => {
      render(<WatchButton productId={1} />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(
          screen.getByText("watchlist.watchButton"),
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Custom className ─────────────────────────────────────────────

  it("passes className to button", async () => {
    mockIsWatchingProduct.mockResolvedValue({
      ok: true,
      data: { watching: false },
    });
    render(<WatchButton productId={1} className="my-custom-class" />, {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      const btn = screen.getByTestId("watch-button");
      expect(btn.className).toContain("my-custom-class");
    });
  });
});
