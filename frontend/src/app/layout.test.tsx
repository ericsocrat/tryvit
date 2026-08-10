import { describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

const { mockGetServerLocale } = vi.hoisted(() => ({
  mockGetServerLocale: vi.fn(),
}));

vi.mock("@/lib/server-locale", () => ({
  getServerLocale: mockGetServerLocale,
}));

describe("RootLayout document language", () => {
  it.each(["en", "pl", "de"] as const)(
    "renders html[lang=%s] from the server locale",
    async (language) => {
      mockGetServerLocale.mockResolvedValueOnce(language);
      const result = await RootLayout({ children: <main>Content</main> });
      expect(result.props.lang).toBe(language);
      expect(result.props["data-design-system"]).toBe("v1");
    },
  );
});
