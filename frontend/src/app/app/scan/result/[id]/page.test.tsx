import { beforeEach, describe, expect, it, vi } from "vitest";
import ScanResultPage from "./page";
const mocks = vi.hoisted(() => ({ redirect: vi.fn((href: string) => { throw new Error(href); }), notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("next/navigation", () => mocks);
beforeEach(() => vi.clearAllMocks());
describe("scan result bookmark", () => {
  it("redirects directly to canonical product evidence without a second interpretation", async () => {
    await expect(ScanResultPage({ params: Promise.resolve({ id: "42" }) })).rejects.toThrow("/app/product/42");
    expect(mocks.redirect).toHaveBeenCalledWith("/app/product/42");
  });
  it.each(["0", "-1", "1.5", "42bad", "01", "9007199254740992"])("rejects invalid product identifier %s", async (id) => {
    await expect(ScanResultPage({ params: Promise.resolve({ id }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
