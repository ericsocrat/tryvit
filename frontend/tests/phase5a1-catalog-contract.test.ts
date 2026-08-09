import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CATALOG_CAPTURE_CONTEXTS,
  CATALOG_CAPTURE_COUNT,
  CATALOG_CAPTURE_VIEWPORTS,
  CATALOG_SCENE_IDS,
} from "@/../tooling/design-system/catalog/capture-contract";
import { catalogSceneIds, getCatalogCopy } from "@/app/dev/components/catalog/registry";

describe("Phase 5A.1a catalog contract", () => {
  it("pins four stable scene IDs across the registry and visual capture contract", () => {
    expect(catalogSceneIds).toEqual([
      "foundations",
      "actions-forms",
      "overlays-navigation",
      "evidence-page-states",
    ]);
    expect(CATALOG_SCENE_IDS).toEqual(catalogSceneIds);
  });

  it("defines exactly 72 candidate section captures without snapshot assertions", () => {
    expect(CATALOG_CAPTURE_CONTEXTS).toHaveLength(6);
    expect(CATALOG_CAPTURE_VIEWPORTS).toHaveLength(3);
    expect(CATALOG_CAPTURE_COUNT).toBe(72);
  });

  it.each(["en", "pl", "de"] as const)("provides typed local catalog copy for %s", (locale) => {
    const copy = getCatalogCopy(locale);
    expect(copy.title).not.toBe("");
    expect(Object.keys(copy.scenes)).toEqual(catalogSceneIds);
    expect(copy.fixtureNote).toMatch(/5A\.1b/u);
  });

  it("keeps the catalog browser project and capture suite isolated from baseline assertions", () => {
    const config = readFileSync(path.join(process.cwd(), "playwright.config.ts"), "utf8");
    const specification = readFileSync(
      path.join(process.cwd(), "e2e", "phase5a1-catalog.spec.ts"),
      "utf8",
    );
    expect(config).toContain('const HAS_PHASE5A1_CATALOG = process.env.PHASE5A1_CATALOG === "1"');
    expect(config).toContain(
      "...(HAS_PHASE5A1_CATALOG && LOCAL_AUTHENTICATED ? [phase5a1CatalogProject] : [])",
    );
    expect(config).toMatch(
      /name: "phase5a1-catalog"[\s\S]*dependencies: \["auth-setup"\][\s\S]*storageState: authStatePath\("user\.json"\)[\s\S]*serviceWorkers: "block"[\s\S]*trace: "off"[\s\S]*screenshot: "off"[\s\S]*video: "off"/u,
    );
    expect(specification).toContain('from "./fixtures/safe-test"');
    expect(specification).toContain('"wcag22aa"');
    expect(specification).toContain("phase5a1-catalog-candidates");
    expect(specification).not.toContain("toHaveScreenshot");
    expect(specification).not.toContain("__screenshots__");
  });
});
