import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CATALOG_CAPTURE_CONTEXTS,
  CATALOG_CAPTURE_COUNT,
  CATALOG_CAPTURE_VIEWPORTS,
  CATALOG_SCENE_IDS,
  getCatalogCandidateRelativePaths,
  parseCatalogSourceStatus,
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
    const candidatePaths = getCatalogCandidateRelativePaths();
    expect(candidatePaths).toHaveLength(90);
    expect(new Set(candidatePaths).size).toBe(90);
    expect(candidatePaths).toContain("en-light-390x844/foundations.png");
    expect(candidatePaths).toContain("de-dark-reduced-1440x900/contact-sheet.png");
    expect(CATALOG_CAPTURE_CONTEXTS.map((context) => context.themePreference)).toContain(
      "system",
    );
    expect(CATALOG_CAPTURE_CONTEXTS.map((context) => context.locale)).toEqual(
      expect.arrayContaining(["en-US", "pl-PL", "de-DE"]),
    );
    expect(CATALOG_CAPTURE_CONTEXTS.some((context) => context.reducedMotion === "reduce"))
      .toBe(true);
    expect(CATALOG_CAPTURE_CONTEXTS.some((context) => context.forcedColors === "active"))
      .toBe(true);
  });

  it("preserves Git's leading status column when classifying Next build output", () => {
    expect(parseCatalogSourceStatus(" M frontend/next-env.d.ts\n")).toEqual({
      status: " M frontend/next-env.d.ts",
      state: "next-build-generated",
    });
    expect(parseCatalogSourceStatus(" M frontend/next-env.d.ts\r\n")).toEqual({
      status: " M frontend/next-env.d.ts",
      state: "next-build-generated",
    });
    expect(parseCatalogSourceStatus("?? test-results/untracked.txt\n").state).toBe(
      "dirty-development-worktree",
    );
    expect(parseCatalogSourceStatus("")).toEqual({ status: "", state: "clean" });
  });

  it.each(["en", "pl", "de"] as const)("provides typed local catalog copy for %s", (locale) => {
    const copy = getCatalogCopy(locale);
    expect(copy.title).not.toBe("");
    expect(Object.keys(copy.scenes)).toEqual(catalogSceneIds);
    expect(copy.specimenNote).toMatch(/5A\.1b/u);
  });

  it("keeps the catalog browser project and capture suite isolated from baseline assertions", () => {
    const config = readFileSync(path.join(process.cwd(), "playwright.config.ts"), "utf8");
    const runner = readFileSync(
      path.join(process.cwd(), "tooling", "design-system", "catalog", "run.mts"),
      "utf8",
    );
    const specification = readFileSync(
      path.join(process.cwd(), "e2e", "phase5a1-catalog.spec.ts"),
      "utf8",
    );
    const verifier = readFileSync(
      path.join(
        process.cwd(),
        "tooling",
        "design-system",
        "catalog",
        "verify-candidates.mts",
      ),
      "utf8",
    );
    const catalogCss = readFileSync(
      path.join(
        process.cwd(),
        "src",
        "app",
        "dev",
        "components",
        "catalog",
        "catalog.css",
      ),
      "utf8",
    );
    const actionsScene = readFileSync(
      path.join(
        process.cwd(),
        "src",
        "app",
        "dev",
        "components",
        "catalog",
        "ActionsFormsScene.tsx",
      ),
      "utf8",
    );
    const sonarConfiguration = readFileSync(
      path.join(process.cwd(), "..", "sonar-project.properties"),
      "utf8",
    );
    expect(config).toContain('const HAS_PHASE5A1_CATALOG = process.env.PHASE5A1_CATALOG === "1"');
    expect(config).toContain(
      "...(HAS_PHASE5A1_CATALOG && LOCAL_AUTHENTICATED ? [phase5a1CatalogProject] : [])",
    );
    expect(config).toMatch(
      /name: "phase5a1-catalog"[\s\S]*retries: 0[\s\S]*serviceWorkers: "block"[\s\S]*trace: "off"[\s\S]*screenshot: "off"[\s\S]*video: "off"/u,
    );
    const projectBlock = config.slice(
      config.indexOf("const phase5a1CatalogProject"),
      config.indexOf("const privatePwaCacheProject"),
    );
    expect(projectBlock).toContain('dependencies: ["auth-setup"]');
    expect(projectBlock).toContain('storageState: authStatePath("user.json")');
    expect(runner).toContain('"local-authenticated"');
    expect(runner).not.toContain('"public"');
    expect(specification).toContain('from "./fixtures/safe-test"');
    expect(specification).toContain('"wcag22aa"');
    expect(specification).toContain("phase5a1-catalog-candidates");
    expect(specification).toContain("phase5a1-catalog-diagnostics");
    expect(specification).toContain("sceneCaptureCount");
    expect(specification).toContain("contactSheetCount");
    expect(specification).toContain("PHASE5A1_CATALOG_SOURCE_SHA");
    expect(specification).toContain("PHASE5A1_CATALOG_PR_HEAD_SHA");
    expect(specification).toContain("sourceTreeSha");
    expect(specification).toContain("sourceWorktreeSha");
    expect(specification).toContain("themePreference");
    expect(specification).toContain("forcedColorProtectedElements");
    expect(specification).not.toContain("toHaveScreenshot");
    expect(specification).not.toContain("__screenshots__");
    expect(verifier).toContain("getCatalogCandidateRelativePaths");
    expect(verifier).toContain("candidate-entry-symlink");
    expect(verifier).toContain("candidate-root-contents-invalid");
    expect(verifier).toContain("candidate-manifest-path-matrix-invalid");
    expect(catalogCss).toMatch(
      /@media \(forced-colors: active\)[\s\S]*\.catalog-v2-button:not\(\[data-variant\]\):not\(:disabled\)[\s\S]*\.catalog-v2-tooltip[\s\S]*forced-color-adjust: none/u,
    );
    expect(catalogCss).toContain(".catalog-v2-field textarea:read-only");
    expect(actionsScene).toContain(
      "<textarea defaultValue={actions.disabledValue} readOnly rows={2} />",
    );
    expect(sonarConfiguration).toContain("frontend/src/design-system/generated/**");
    expect(sonarConfiguration).toContain(
      "sonar.issue.ignore.multicriteria.tailwindCustomVariant.ruleKey=css:S8776",
    );
    expect(sonarConfiguration).toContain(
      "sonar.issue.ignore.multicriteria.tailwindCustomVariant.resourceKey=frontend/src/styles/globals.css",
    );
  });

  it("uses fully localized representative copy, including long Polish and German fixtures", () => {
    const english = getCatalogCopy("en");
    const polish = getCatalogCopy("pl");
    const german = getCatalogCopy("de");
    expect(polish.actions.fullWidth).not.toBe(english.actions.fullWidth);
    expect(german.actions.fullWidth.length).toBeGreaterThan(english.actions.fullWidth.length);
    expect(polish.evidence.allergenNames).not.toEqual(english.evidence.allergenNames);
    expect(german.evidence.fixtureDescription).not.toBe(english.evidence.fixtureDescription);
  });
});
