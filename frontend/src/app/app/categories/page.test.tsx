import { expect, it, vi } from "vitest";
import CategoriesPage from "./page";
const redirect = vi.hoisted(() => vi.fn((href: string) => { throw new Error(href); }));
vi.mock("next/navigation", () => ({ redirect }));
it("preserves the category index bookmark through the canonical Find disclosure", () => {
  expect(() => CategoriesPage()).toThrow("/app/search?panel=categories");
  expect(redirect).toHaveBeenCalledWith("/app/search?panel=categories");
});
