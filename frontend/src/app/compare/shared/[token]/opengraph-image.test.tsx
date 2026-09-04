// ─── Unit tests for comparison OG image helper functions ─────────────────────
// Tests the pure functions exported from opengraph-image.tsx.
// The full image generation is an integration concern (needs edge runtime).

import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { truncate } from "./opengraph-image";

const source = readFileSync(
  join(process.cwd(), "src/app/compare/shared/[token]/opengraph-image.tsx"),
  "utf8",
);

// Make React available globally for JSX in the tested module
vi.stubGlobal("React", React);

// Mock next/og — ImageResponse is used with `new`
vi.mock("next/og", () => {
  const ImageResponseMock = vi.fn().mockImplementation(function (this: Response) {
    return new Response();
  });
  return { ImageResponse: ImageResponseMock };
});

vi.mock("@/lib/server-locale", () => ({
  getServerLocale: () => Promise.resolve("en"),
}));

describe("comparison opengraph-image helpers", () => {
  it("publishes identities and evidence context without score claims", () => {
    expect(source).toContain("shared.evidenceReviewRequired");
    expect(source).toContain("shared.reviewEvidenceInTryVit");
    expect(source).not.toContain("unhealthiness_score");
    expect(source).not.toContain("getScoreHex");
    expect(source).not.toContain("/100");
  });

  /* ── truncate ──────────────────────────────────────────────────────────── */
  describe("truncate", () => {
    it("returns text unchanged when shorter than max", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    it("returns text unchanged when exactly at max", () => {
      expect(truncate("hello", 5)).toBe("hello");
    });

    it("truncates with ellipsis when text exceeds max", () => {
      const result = truncate("A very long product name indeed", 15);
      expect(result).toHaveLength(15);
      expect(result).toMatch(/…$/);
    });

    it("preserves full text at boundary", () => {
      expect(truncate("abc", 3)).toBe("abc");
    });
  });

  /* ── module exports ────────────────────────────────────────────────────── */
  describe("module exports", () => {
    beforeEach(() => {
      vi.resetModules();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        }),
      );
    });

    it("exports correct size (1200×630)", async () => {
      const mod = await import("./opengraph-image");
      expect(mod.size).toEqual({ width: 1200, height: 630 });
    });

    it("exports png content type", async () => {
      const mod = await import("./opengraph-image");
      expect(mod.contentType).toBe("image/png");
    });

    it("exports alt text for comparison", async () => {
      const mod = await import("./opengraph-image");
      expect(mod.alt).toContain("comparison");
    });

    it("exports a revalidate value", async () => {
      const mod = await import("./opengraph-image");
      expect(mod.revalidate).toBeGreaterThan(0);
    });

    it("default export is a function", async () => {
      const mod = await import("./opengraph-image");
      expect(typeof mod.default).toBe("function");
    });

    it("returns a fallback image when public comparison data is unavailable", async () => {
      vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "demo");
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });
      vi.stubGlobal("fetch", fetchMock);

      const mod = await import("./opengraph-image");
      const response = await mod.default({
        params: Promise.resolve({ token: "invalid-token" }),
      });

      expect(response).toBeInstanceOf(Response);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls.flat().join(" ")).not.toContain("api_get_shared_comparison");
    });
  });
});
