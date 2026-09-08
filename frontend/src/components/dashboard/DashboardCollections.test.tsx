import en from "@/../messages/en.json";
import { translateFromMessages, type InterpolationParams } from "@/lib/i18n-format";
import type { HomeReadModel } from "@/lib/evidence/home";
import { evidenceProduct } from "@/components/evidence/product-evidence.fixtures";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardCollections } from "./DashboardCollections";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    language: "en",
    t: (key: string, params?: InterpolationParams) => translateFromMessages(en, undefined, key, params),
  }),
}));

function favorite(id: number, _overrides: { unhealthiness_score?: null } = {}): HomeReadModel["favorites_preview"][number] {
  const product = evidenceProduct(id); product.product_name = `Favorite ${id}`; product.brand = `Brand ${id}`;
  return { product_id: id, added_at: "2026-09-04T12:00:00.000Z", product };
}

describe("DashboardCollections", () => {
  it("uses actual saved counts, independently of the preview length", () => {
    render(<DashboardCollections favorites={[favorite(1)]} stats={{ favorites_count: 12, lists_count: 4 }} />);
    expect(screen.getByText("12 favorites")).toBeInTheDocument();
    expect(screen.getByText("4 lists")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Your collections" })).toBeInTheDocument();
  });

  it("renders up to three real favorites in their supplied order", () => {
    render(<DashboardCollections favorites={[favorite(8), favorite(3), favorite(5), favorite(2)]} stats={{ favorites_count: 4, lists_count: 2 }} />);
    const rows = screen.getAllByTestId("dashboard-favorite-item");
    expect(rows).toHaveLength(3);
    [8, 3, 5].forEach((id, index) => {
      expect(rows[index]).toHaveAttribute("href", `/app/product/${id}`);
      expect(within(rows[index]).getByText(`Favorite ${id}`)).toBeInTheDocument();
    });
    expect(screen.queryByText("Favorite 2")).not.toBeInTheDocument();
  });

  it("retains favorite identity without presenting any legacy score", () => {
    render(<DashboardCollections favorites={[favorite(1), favorite(2, { unhealthiness_score: null })]} stats={{ favorites_count: 2, lists_count: 1 }} />);
    expect(screen.getByRole("link", { name: /Favorite 1/ })).toHaveAttribute("href", "/app/product/1");
    expect(screen.getByRole("link", { name: /Favorite 2/ })).toHaveAttribute("href", "/app/product/2");
    expect(screen.queryByText(/score|\/100|higher is better/i)).not.toBeInTheDocument();
  });

  it("explains how to save a favorite when the actual saved count is zero", () => {
    render(<DashboardCollections favorites={[]} stats={{ favorites_count: 0, lists_count: 0 }} />);
    expect(screen.getByText("0 favorites")).toBeInTheDocument();
    expect(screen.getByText("0 lists")).toBeInTheDocument();
    expect(screen.getByText("Make room for your favorites")).toBeInTheDocument();
    expect(screen.getByText("Save a product with the heart button to find it here.")).toBeInTheDocument();
  });

  it("does not claim favorites are empty when a nonzero count has no preview", () => {
    render(<DashboardCollections favorites={[]} stats={{ favorites_count: 3, lists_count: 1 }} />);
    expect(screen.getByText("3 favorites")).toBeInTheDocument();
    expect(screen.getByText("Open your lists to see your saved favorites.")).toBeInTheDocument();
    expect(screen.queryByText("Make room for your favorites")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-favorite-item")).not.toBeInTheDocument();
  });

  it("links to the supported lists route without inventing a favorites list ID", () => {
    render(<DashboardCollections favorites={[]} stats={{ favorites_count: 1, lists_count: 1 }} />);
    expect(screen.getByRole("link", { name: "Open lists" })).toHaveAttribute("href", "/app/lists");
    expect(screen.getByText("1 favorite")).toBeInTheDocument();
    expect(screen.getByText("1 list")).toBeInTheDocument();
  });

  it("keeps comparison creation and saved comparisons available", () => {
    render(<DashboardCollections favorites={[]} stats={{ favorites_count: 0, lists_count: 0 }} />);
    expect(screen.getByRole("link", { name: "Compare products" })).toHaveAttribute("href", "/app/compare");
    expect(screen.getByRole("link", { name: "Saved comparisons" })).toHaveAttribute("href", "/app/compare/saved");
  });
});
