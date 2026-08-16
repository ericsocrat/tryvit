import { describe, expect, it } from "vitest";

import { domainGlyphRegistry } from "./domain-glyph-contract";

describe("Phase 5A.1b domain glyph contract", () => {
  it("does not imply approval of any new identity or domain artwork", () => {
    expect(Object.keys(domainGlyphRegistry)).toEqual([]);
  });
});
