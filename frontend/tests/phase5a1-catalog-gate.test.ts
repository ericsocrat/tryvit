import { describe, expect, it } from "vitest";

import {
  isPhase5A1CatalogOpen,
} from "@/design-system/catalog/catalog-gate";

describe("Phase 5A.1a catalog production gate", () => {
  it("keeps the catalog available for local development only", () => {
    expect(isPhase5A1CatalogOpen({ nodeEnv: "development" })).toBe(true);
    expect(isPhase5A1CatalogOpen({ nodeEnv: "test" })).toBe(true);
  });

  it("closes normal production and either incomplete CI opt-in", () => {
    expect(isPhase5A1CatalogOpen({ nodeEnv: "production" })).toBe(false);
    expect(
      isPhase5A1CatalogOpen({ nodeEnv: "production", phase5a1Catalog: "1" }),
    ).toBe(false);
    expect(isPhase5A1CatalogOpen({ nodeEnv: "production", qaMode: "1" })).toBe(false);
  });

  it("requires both the server-only catalog and public QA flags in production", () => {
    expect(
      isPhase5A1CatalogOpen({
        nodeEnv: "production",
        phase5a1Catalog: "1",
        qaMode: "1",
      }),
    ).toBe(true);
  });
});
