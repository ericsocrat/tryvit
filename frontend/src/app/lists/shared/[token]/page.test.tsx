import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SharedListPage from "./page";
import { legacyProduct } from "@/components/evidence/product-evidence.fixtures";
const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/public-shares", () => ({ readPublicSharedList: read }));
vi.mock("@/lib/server-locale", () => ({ getServerLocale: async () => "en" }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
const data = () => ({ title: "My shared selection", total_count: 2, unavailable_count: 0, limit: 50, offset: 0, products: [legacyProduct(1), legacyProduct(2)] });
const renderPage = async (page?: string) => render(await SharedListPage({ params: Promise.resolve({ token: "aaaabbbbccccddddeeeeffff" }), searchParams: Promise.resolve({ page }) }));
beforeEach(() => vi.clearAllMocks());

describe("public list facts", () => {
  it("keeps invalid links distinct from unavailable service", async () => {
    read.mockResolvedValue({ status: "invalid" }); await renderPage();
    expect(screen.getByRole("heading", { name: "List not found" })).toBeInTheDocument();
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
  });
  it("offers a retry for a transient service failure", async () => {
    read.mockResolvedValue({ status: "unavailable" }); await renderPage();
    expect(screen.getByRole("heading", { name: "Shared data is temporarily unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/lists/shared/aaaabbbbccccddddeeeeffff?page=1");
  });
  it("shows approved title and product facts, not private descriptions or scores", async () => {
    read.mockResolvedValue({ status: "ok", data: { ...data(), description: "PRIVATE NOTE" } }); await renderPage();
    expect(screen.getByText("My shared selection")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fixture product 1" })).toBeInTheDocument();
    expect(screen.queryByText("PRIVATE NOTE")).not.toBeInTheDocument();
    expect(screen.queryByText("TryVit Score")).not.toBeInTheDocument();
    expect(screen.getAllByText("Nutrition details")).toHaveLength(2);
  });
  it("does not call an unavailable selection genuinely empty", async () => {
    read.mockResolvedValue({ status: "ok", data: { ...data(), products: [], total_count: 0, unavailable_count: 2 } }); await renderPage();
    expect(screen.getByText("No products in this selection are currently available.")).toBeInTheDocument();
    expect(screen.queryByText("This list is empty.")).not.toBeInTheDocument();
  });
  it("renders genuinely empty lists", async () => {
    read.mockResolvedValue({ status: "ok", data: { ...data(), products: [], total_count: 0 } }); await renderPage();
    expect(screen.getByText("This list is empty.")).toBeInTheDocument();
  });
  it("passes locale and page offset and provides reversible navigation", async () => {
    read.mockResolvedValue({ status: "ok", data: { ...data(), total_count: 120, offset: 50 } }); await renderPage("2");
    expect(read).toHaveBeenCalledWith("aaaabbbbccccddddeeeeffff", "en", 50);
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/lists/shared/aaaabbbbccccddddeeeeffff?page=1");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/lists/shared/aaaabbbbccccddddeeeeffff?page=3");
  });
});
