import { assertComponentA11y } from "@/utils/test/a11y";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Navigation } from "./Navigation";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPathname = vi.fn<() => string>().mockReturnValue("/app/search");
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));

const translations: Record<string, string> = {
  "a11y.mainNavigation": "Main navigation",
  "nav.home": "Dashboard",
  "nav.search": "Search",
  "nav.scan": "Scan",
  "nav.lists": "Lists",
  "nav.more": "More",
};
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    language: "en",
    t: (key: string) => translations[key] ?? key,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    prefetch?: boolean;
  }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

const mockUseLists = vi.fn().mockReturnValue({ data: undefined });
vi.mock("@/hooks/use-lists", () => ({
  useLists: () => mockUseLists(),
}));

const mockCompareCount = vi.fn().mockReturnValue(0);
vi.mock("@/stores/compare-store", () => ({
  useCompareStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ count: mockCompareCount }),
}));

describe("Navigation", () => {
  it("renders all 5 nav items", () => {
    render(<Navigation />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Scan")).toBeInTheDocument();
    expect(screen.getByText("Lists")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });

  it("has correct hrefs", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/app/search");
    expect(screen.getByRole("link", { name: "Scan" })).toHaveAttribute("href", "/app/scan");
  });

  it("does not prefetch persistent authenticated destinations", () => {
    render(<Navigation />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });

  it("marks active item with aria-current=page", () => {
    mockPathname.mockReturnValue("/app/search");
    render(<Navigation />);
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("matches nested route as active", () => {
    mockPathname.mockReturnValue("/app/search/results");
    render(<Navigation />);
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("aria-current", "page");
  });

  it("marks Dashboard active only on exact /app path", () => {
    mockPathname.mockReturnValue("/app");
    render(<Navigation />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark Dashboard active for nested paths", () => {
    mockPathname.mockReturnValue("/app/search");
    render(<Navigation />);
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("no item active for unmatched path", () => {
    mockPathname.mockReturnValue("/onboarding");
    render(<Navigation />);
    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("renders the nav landmark", () => {
    render(<Navigation />);
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
  });

  it("is hidden on desktop (lg+ breakpoint)", () => {
    render(<Navigation />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(nav.className).toContain("lg:hidden");
  });

  // ── Badge counts (§4.6) ──────────────────────────────────────────────

  it("shows badge count on Lists when user has lists", () => {
    mockUseLists.mockReturnValue({
      data: {
        api_version: "1.0",
        lists: [
          { list_id: "1", name: "Favorites" },
          { list_id: "2", name: "Avoid" },
          { list_id: "3", name: "Keto" },
        ],
      },
    });
    render(<Navigation />);
    const badge = screen.getByTestId("nav-badge-lists");
    expect(badge).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: "3 Lists" })).toHaveAttribute("href", "/app/lists");
  });

  it("hides badge on Lists when user has no lists", () => {
    mockUseLists.mockReturnValue({ data: { api_version: "1.0", lists: [] } });
    render(<Navigation />);
    expect(screen.queryByTestId("nav-badge-lists")).not.toBeInTheDocument();
  });

  it("hides badge when lists data is undefined (loading)", () => {
    mockUseLists.mockReturnValue({ data: undefined });
    render(<Navigation />);
    expect(screen.queryByTestId("nav-badge-lists")).not.toBeInTheDocument();
  });

  it("caps badge display at 99+", () => {
    const manyLists = Array.from({ length: 150 }, (_, i) => ({
      list_id: String(i),
      name: `List ${i}`,
    }));
    mockUseLists.mockReturnValue({
      data: { api_version: "1.0", lists: manyLists },
    });
    render(<Navigation />);
    const badge = screen.getByTestId("nav-badge-lists");
    expect(badge).toHaveTextContent("99+");
    expect(screen.getByRole("link", { name: "99+ Lists" })).toBeInTheDocument();
  });

  // ── More button & drawer (§67) ──────────────────────────────────────────

  it("More button has aria-haspopup=dialog", () => {
    render(<Navigation />);
    const moreBtn = screen.getByText("More").closest("button");
    expect(moreBtn).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("More button toggles drawer open/close", async () => {
    render(<Navigation />);
    const moreBtn = screen.getByText("More").closest("button")!;
    expect(moreBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(moreBtn);
    expect(moreBtn).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("highlights More button when active route is in drawer", () => {
    mockPathname.mockReturnValue("/app/compare");
    render(<Navigation />);
    const moreBtn = screen.getByText("More").closest("button");
    expect(moreBtn?.className).toContain("text-brand");
  });

  // ── Compare badge on More button ──────────────────────────────────────

  it("shows compare badge on More button when products are selected", () => {
    mockCompareCount.mockReturnValue(3);
    render(<Navigation />);
    const badge = screen.getByTestId("nav-badge-compare");
    expect(badge).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: "3 More" })).toBeInTheDocument();
  });

  it("hides compare badge when no products are selected", () => {
    mockCompareCount.mockReturnValue(0);
    render(<Navigation />);
    expect(screen.queryByTestId("nav-badge-compare")).not.toBeInTheDocument();
  });

  it("caps compare badge at 9+", () => {
    mockCompareCount.mockReturnValue(10);
    render(<Navigation />);
    const badge = screen.getByTestId("nav-badge-compare");
    expect(badge).toHaveTextContent("9+");
    expect(screen.getByRole("button", { name: "9+ More" })).toBeInTheDocument();
  });

  it("passes axe with visible Lists and compare badge names", async () => {
    mockUseLists.mockReturnValue({
      data: {
        api_version: "1.0",
        lists: [
          { list_id: "1", name: "Favorites" },
          { list_id: "2", name: "Avoid" },
          { list_id: "3", name: "Keto" },
        ],
      },
    });
    mockCompareCount.mockReturnValue(3);

    await assertComponentA11y(<Navigation />);
  });
});
