import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SharedComparisonPage from "./page";
import { evidenceProduct, legacyProduct } from "@/components/evidence/product-evidence.fixtures";
const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/public-shares", () => ({ readPublicSharedComparison: read }));
vi.mock("@/lib/server-locale", () => ({ getServerLocale: async () => "en" }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
const data = () => ({ title: "My shared comparison", product_count: 2, unavailable_count: 0, products: [evidenceProduct(1), evidenceProduct(2, { value: "0.002" })] });
const renderPage = async () => render(await SharedComparisonPage({ params: Promise.resolve({ token: "aaaabbbbccccddddeeeeffff" }) }));
beforeEach(() => vi.clearAllMocks());

describe("public comparison facts", () => {
  it("keeps invalid links and unavailable service distinct", async () => {
    read.mockResolvedValue({ status: "invalid" }); await renderPage();
    expect(screen.getByRole("heading", { name: /invalid or has expired/i })).toBeInTheDocument();
  });
  it("offers retry without suggesting a bad token for service failure", async () => {
    read.mockResolvedValue({ status: "unavailable" }); await renderPage();
    expect(screen.getByRole("link", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText(/invalid or has expired/i)).not.toBeInTheDocument();
  });
  it("compares compatible recorded values, never declares an overall winner", async () => {
    read.mockResolvedValue({ status: "ok", data: data() }); await renderPage();
    expect(screen.getByRole("table")).toHaveTextContent("Higher recorded value");
    expect(screen.getByRole("table")).toHaveTextContent("Lower recorded values do not mean an overall healthier product.");
    expect(screen.queryByText("TryVit Score")).not.toBeInTheDocument();
    expect(screen.queryByText(/best option/i)).not.toBeInTheDocument();
  });
  it("withholds arithmetic for legacy evidence", async () => {
    read.mockResolvedValue({ status: "ok", data: { ...data(), products: [legacyProduct(1), evidenceProduct(2)] } }); await renderPage();
    expect(screen.getByRole("table")).toHaveTextContent("Not comparable with this evidence");
    expect(screen.getByRole("table")).not.toHaveTextContent("Higher recorded value");
  });
  it("keeps a partial share usable but explains missing comparison evidence", async () => {
    read.mockResolvedValue({ status: "ok", data: { ...data(), product_count: 1, unavailable_count: 1, products: [evidenceProduct(1)] } }); await renderPage();
    expect(screen.getByText("At least two available products are needed for a factual comparison.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to your invited account" })).toHaveAttribute("href", "/auth/login");
  });
  it("passes token and language to the read without a user account dependency", async () => {
    read.mockResolvedValue({ status: "invalid" }); await renderPage();
    expect(read).toHaveBeenCalledWith("aaaabbbbccccddddeeeeffff", "en");
  });
});
