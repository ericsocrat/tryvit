import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SharedLayout, { generateMetadata } from "./layout";
vi.mock("@/lib/server-locale", () => ({ getServerLocale: async () => "en" }));
describe("private-content-safe share metadata", () => {
  it("renders children", () => { render(<SharedLayout><p>Shared page content</p></SharedLayout>); expect(screen.getByText("Shared page content")).toBeInTheDocument(); });
  it("uses generic metadata without fetching token-gated content", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const metadata = await generateMetadata();
    expect(metadata.title).toBe("Shared product list");
    expect(metadata.description).toContain("source limitations");
    expect(metadata.referrer).toBe("no-referrer");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals();
  });
});
