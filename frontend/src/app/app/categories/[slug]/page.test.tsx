import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as SearchApi from "@/lib/evidence/search";
import CategoryPage from "./page";
const mocks = vi.hoisted(() => ({ options: vi.fn(), redirect: vi.fn((href: string) => { throw new Error(href); }), notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/lib/evidence/search", async (original) => ({ ...await original<typeof SearchApi>(), findFilterOptions: mocks.options }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({}) }));
vi.mock("@/lib/server-locale", () => ({ getServerLocale: async () => "en" }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.options.mockResolvedValue({ ok: true, data: { api_version: "2", country: "PL", language: "en", categories: [{ value: "Seafood & Fish", slug: "seafood-fish", label: "Fish" }] } });
});
describe("canonical category bookmark", () => {
  it("resolves the actual slug and carries category identity plus market into Find", async () => {
    await expect(CategoryPage({ params: Promise.resolve({ slug: "seafood-fish" }) })).rejects.toThrow("/app/search?category=Seafood+%26+Fish&country=PL");
    expect(mocks.options).toHaveBeenCalledWith({}, null, "en");
  });
  it.each(["seafood-and-fish", "unknown", "../dairy"])("does not invent a registry slug for %s", async (slug) => {
    await expect(CategoryPage({ params: Promise.resolve({ slug }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("keeps metadata unavailability distinct from category absence", async () => {
    mocks.options.mockResolvedValue({ ok: false, error: { message: "Unavailable" } });
    render(await CategoryPage({ params: Promise.resolve({ slug: "seafood-fish" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Category choices couldn’t load");
    expect(screen.getByRole("link", { name: "Find" })).toHaveAttribute("href", "/app/search?panel=categories");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
