import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SharedListPage from "./page";

const { mockReadPublicSharedList } = vi.hoisted(() => ({
  mockReadPublicSharedList: vi.fn(),
}));

vi.mock("@/lib/public-shares", () => ({
  readPublicSharedList: mockReadPublicSharedList,
}));

vi.mock("@/lib/server-locale", () => ({
  getServerLocale: () => Promise.resolve("en"),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockListData = {
  api_version: "1",
  list_name: "My Favorites",
  description: "Best foods I found",
  list_type: "custom",
  total_count: 2,
  limit: 50,
  offset: 0,
  items: [
    {
      product_id: 1,
      product_name: "Chips Original",
      brand: "Lay's",
      category: "Chips",
      unhealthiness_score: 72,
      nutri_score_label: "D",
    },
    {
      product_id: 2,
      product_name: "Green Juice",
      brand: "Suja",
      category: "Drinks",
      unhealthiness_score: 15,
      nutri_score_label: "A",
    },
  ],
};

async function renderPage(token = "abc123") {
  render(await SharedListPage({ params: Promise.resolve({ token }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SharedListPage", () => {
  it("degrades without a backend-dependent provider", async () => {
    mockReadPublicSharedList.mockResolvedValue({ status: "invalid" });
    await renderPage();

    expect(screen.getByText("List not found")).toBeInTheDocument();
    expect(screen.getByText("Go home").closest("a")).toHaveAttribute("href", "/");
  });

  it("describes unavailable shared data truthfully", async () => {
    mockReadPublicSharedList.mockResolvedValue({ status: "unavailable" });
    await renderPage();

    expect(screen.getByText("Shared data is temporarily unavailable")).toBeInTheDocument();
    expect(screen.queryByText("List not found")).not.toBeInTheDocument();
  });

  it("renders list details and product count", async () => {
    mockReadPublicSharedList.mockResolvedValue({ status: "ok", data: mockListData });
    await renderPage();

    expect(screen.getByText("My Favorites")).toBeInTheDocument();
    expect(screen.getByText("Best foods I found")).toBeInTheDocument();
    expect(screen.getByText("2 products")).toBeInTheDocument();
  });

  it("renders products and brands", async () => {
    mockReadPublicSharedList.mockResolvedValue({ status: "ok", data: mockListData });
    await renderPage();

    expect(screen.getByText("Chips Original")).toBeInTheDocument();
    expect(screen.getByText("Green Juice")).toBeInTheDocument();
    expect(screen.getByText(/Lay's/)).toBeInTheDocument();
  });

  it("renders empty lists truthfully", async () => {
    mockReadPublicSharedList.mockResolvedValue({
      status: "ok",
      data: { ...mockListData, items: [] },
    });
    await renderPage();
    expect(screen.getByText("This list is empty.")).toBeInTheDocument();
  });

  it("renders the shared-list label", async () => {
    mockReadPublicSharedList.mockResolvedValue({ status: "ok", data: mockListData });
    await renderPage();
    expect(screen.getByText("Shared list")).toBeInTheDocument();
  });

  it("passes the route token to the guarded server read", async () => {
    mockReadPublicSharedList.mockResolvedValue({ status: "invalid" });
    await renderPage("safe-token");
    expect(mockReadPublicSharedList).toHaveBeenCalledWith("safe-token");
  });
});
