import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OGImage, { revalidate, dynamic } from "./opengraph-image";
vi.mock("@/lib/server-locale", () => ({ getServerLocale: async () => "en" }));
vi.mock("next/og", () => ({ ImageResponse: class { constructor(public element: React.ReactNode, public options: Record<string, unknown>) {} } }));
describe("generic revocation-safe share preview", () => {
  it("fetches no user content or remote fonts and uses explicit no-store headers", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const result = await OGImage() as unknown as { element: React.ReactNode; options: { headers: Record<string, string> } };
    render(result.element);
    expect(screen.getByText("Shared product list")).toBeInTheDocument();
    expect(result.options.headers["Cache-Control"]).toBe("private, no-store, max-age=0");
    expect(result.options.headers["Vercel-CDN-Cache-Control"]).toBe("no-store");
    expect(revalidate).toBe(0); expect(dynamic).toBe("force-dynamic");
    expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals();
  });
});
