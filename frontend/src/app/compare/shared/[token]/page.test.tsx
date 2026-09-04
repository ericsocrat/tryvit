import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SharedComparisonPage from "./page";

const { mockReadPublicSharedComparison } = vi.hoisted(() => ({
  mockReadPublicSharedComparison: vi.fn(),
}));

vi.mock("@/lib/public-shares", () => ({
  readPublicSharedComparison: mockReadPublicSharedComparison,
}));

vi.mock("@/lib/server-locale", () => ({
  getServerLocale: () => Promise.resolve("en"),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const comparison = {
  api_version: "1",
  comparison_id: "cmp-1",
  title: "Chips vs Drinks",
  product_count: 2,
  created_at: "2025-01-15T10:00:00Z",
  products: [
    { product_id: 1, product_name: "Product A", brand: "Brand A" },
    { product_id: 2, product_name: "Product B", brand: "Brand B" },
  ],
};

async function renderPage(token = "comp-token-xyz") {
  render(await SharedComparisonPage({ params: Promise.resolve({ token }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SharedComparisonPage", () => {
  it("degrades without a backend-dependent provider", async () => {
    mockReadPublicSharedComparison.mockResolvedValue({ status: "invalid" });
    await renderPage();

    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByText("Go to TryVit").closest("a")).toHaveAttribute("href", "/");
  });

  it("describes unavailable shared data truthfully", async () => {
    mockReadPublicSharedComparison.mockResolvedValue({ status: "unavailable" });
    await renderPage();

    expect(screen.getByText(/shared product data cannot be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/invalid or has expired/i)).not.toBeInTheDocument();
  });

  it("renders product identities while withholding public scores and rankings", async () => {
    mockReadPublicSharedComparison.mockResolvedValue({ status: "ok", data: comparison });
    await renderPage();

    expect(screen.getByText("Chips vs Drinks")).toBeInTheDocument();
    expect(screen.getByText(/2 products compared/)).toBeInTheDocument();
    expect(screen.getByText("Product A")).toBeInTheDocument();
    expect(screen.getByText("Brand B")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Scores and rankings are withheld because this public link does not include the supporting provenance and freshness evidence.",
    );
    expect(screen.queryByText("TryVit Score")).not.toBeInTheDocument();
  });

  it("uses the localized default title", async () => {
    mockReadPublicSharedComparison.mockResolvedValue({
      status: "ok",
      data: { ...comparison, title: null },
    });
    await renderPage();
    expect(screen.getByText("Product Comparison")).toBeInTheDocument();
  });

  it("renders the public label and CTA", async () => {
    mockReadPublicSharedComparison.mockResolvedValue({ status: "ok", data: comparison });
    await renderPage();

    expect(screen.getByText("Shared comparison")).toBeInTheDocument();
    expect(screen.getByText("Sign up for free").closest("a")).toHaveAttribute(
      "href",
      "/auth/login",
    );
  });

  it("passes the route token to the guarded server read", async () => {
    mockReadPublicSharedComparison.mockResolvedValue({ status: "invalid" });
    await renderPage("safe-comparison-token");
    expect(mockReadPublicSharedComparison).toHaveBeenCalledWith("safe-comparison-token");
  });
});
