// ─── Unit tests for product Open Graph image publishing ───────────────
// The full image generation is an integration concern (needs the Next.js
// ImageResponse runtime), so these tests cover its pure helper and claim boundary.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { alt, truncate } from "./opengraph-image";

const source = readFileSync(
  join(process.cwd(), "src/app/app/product/[id]/opengraph-image.tsx"),
  "utf8",
);

describe("opengraph-image", () => {
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

  it("publishes a neutral evidence card without score or warning claims", () => {
    expect(alt).toBe("Product evidence card");
    expect(source).toContain("product.ogEvidenceSummary");
    expect(source).toContain("product.ogEvidenceAvailability");
    expect(source).toContain("p_language: language");
    expect(source).not.toContain("unhealthiness_score");
    expect(source).not.toContain("profile.warnings");
    expect(source).not.toContain("/100");
    expect(source).not.toContain("getScoreHex");
  });
});
