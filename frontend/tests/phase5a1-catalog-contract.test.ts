import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CATALOG_CANDIDATE_FILE_COUNT,
  CATALOG_CAPTURE_CASE_COUNT,
  CATALOG_CAPTURE_CONTEXTS,
  CATALOG_CAPTURE_COUNT,
  CATALOG_CAPTURE_VIEWPORTS,
  CATALOG_CONTACT_SHEET_COUNT,
  CATALOG_EVIDENCE_CHECK_IDS,
  CATALOG_EVIDENCE_RECORD_COUNT,
  CATALOG_INTERACTION_CAPTURE_COUNT,
  CATALOG_INTERACTION_CAPTURE_IDS,
  CATALOG_MANIFEST_ENTRY_COUNT,
  CATALOG_PNG_COUNT,
  CATALOG_RESILIENCE_CAPTURE_COUNT,
  CATALOG_SCENE_CAPTURE_COUNT,
  CATALOG_SCENE_IDS,
  getCatalogCandidatePngRelativePaths,
  getCatalogCandidateRelativePaths,
  getCatalogExpectedEvidenceRecords,
  parseCatalogSourceStatus,
} from "@/../tooling/design-system/catalog/capture-contract";
import { catalogSceneIds, getCatalogCopy } from "@/app/dev/components/catalog/registry";

describe("Phase 5A.1b catalog contract", () => {
  it("preserves the four stable foundation scene IDs", () => {
    expect(catalogSceneIds).toEqual([
      "foundations",
      "actions-forms",
      "overlays-navigation",
      "evidence-page-states",
    ]);
    expect(CATALOG_SCENE_IDS).toEqual(catalogSceneIds);
  });

  it("pins the exact canonical primitive candidate matrix without snapshot assertions", () => {
    expect(CATALOG_CAPTURE_CONTEXTS).toHaveLength(6);
    expect(CATALOG_CAPTURE_VIEWPORTS).toHaveLength(3);
    expect(CATALOG_CAPTURE_CASE_COUNT).toBe(18);
    expect(CATALOG_SCENE_CAPTURE_COUNT).toBe(72);
    expect(CATALOG_INTERACTION_CAPTURE_IDS).toHaveLength(9);
    expect(CATALOG_INTERACTION_CAPTURE_COUNT).toBe(162);
    expect(CATALOG_RESILIENCE_CAPTURE_COUNT).toBe(24);
    expect(CATALOG_CAPTURE_COUNT).toBe(258);
    expect(CATALOG_CONTACT_SHEET_COUNT).toBe(36);
    expect(CATALOG_PNG_COUNT).toBe(294);
    expect(CATALOG_EVIDENCE_RECORD_COUNT).toBe(18);
    expect(CATALOG_EVIDENCE_CHECK_IDS).toHaveLength(35);
    expect(CATALOG_EVIDENCE_CHECK_IDS).toEqual(
      expect.arrayContaining([
        "focus-not-obscured",
        "combobox-status-states",
        "axe-combobox-loading-open",
        "axe-combobox-empty-open",
        "axe-combobox-error-open",
        "nested-outside-non-cascade",
        "switch-direction",
        "target-size",
      ]),
    );
    expect(CATALOG_MANIFEST_ENTRY_COUNT).toBe(295);
    expect(CATALOG_CANDIDATE_FILE_COUNT).toBe(296);

    const pngPaths = getCatalogCandidatePngRelativePaths();
    const candidatePaths = getCatalogCandidateRelativePaths();
    expect(pngPaths).toHaveLength(294);
    expect(candidatePaths).toHaveLength(295);
    expect(new Set(candidatePaths).size).toBe(295);
    expect(candidatePaths).toContain("en-light-390x844/foundations.png");
    expect(candidatePaths).toContain(
      "en-light-390x844/actions-forms--combobox-open.png",
    );
    expect(candidatePaths).toContain(
      "de-dark-reduced-1440x900/overlays-navigation--tooltip-focus-open.png",
    );
    expect(candidatePaths).toContain(
      "pl-light-reduced-768x1024/interaction-contact-sheet.png",
    );
    expect(candidatePaths).toContain(
      "en-light-390x844/actions-forms--combobox-loading-open.png",
    );
    expect(candidatePaths).toContain(
      "en-forced-colors-1440x900/actions-forms--combobox-error-open.png",
    );
    expect(candidatePaths).toContain(
      "de-dark-reduced-1440x900/catalog-shell--text-spacing.png",
    );
    expect(candidatePaths).toContain(
      "pl-light-reduced-768x1024/catalog-shell--zoom-200.png",
    );
    expect(candidatePaths).not.toContain(
      "pl-light-reduced-390x844/catalog-shell--zoom-200.png",
    );
    expect(candidatePaths).toContain("evidence.json");
    expect(CATALOG_CAPTURE_CONTEXTS.map((context) => context.themePreference)).toContain(
      "system",
    );
    expect(CATALOG_CAPTURE_CONTEXTS.map((context) => context.locale)).toEqual(
      expect.arrayContaining(["en-US", "pl-PL", "de-DE"]),
    );
    expect(CATALOG_CAPTURE_CONTEXTS.map((context) => context.pointer)).toEqual(
      expect.arrayContaining(["fine", "coarse"]),
    );
    expect(CATALOG_CAPTURE_CONTEXTS.map((context) => context.hover)).toEqual(
      expect.arrayContaining(["hover", "none"]),
    );
  });

  it("defines one exact sanitized success-evidence record per capture case", () => {
    const records = getCatalogExpectedEvidenceRecords();
    expect(records).toHaveLength(18);
    expect(new Set(records.map(({ id }) => id)).size).toBe(18);
    for (const record of records) {
      expect(Object.keys(record.checks)).toEqual(CATALOG_EVIDENCE_CHECK_IDS);
      expect(
        Object.values(record.checks).every((value) =>
          value === "pass" || value === "not-applicable",
        ),
      ).toBe(true);
    }
    expect(
      records.find(({ id }) => id === "en-system-dark-768x1024")?.checks,
    ).toMatchObject({
      "system-theme": "pass",
      "zoom-200": "pass",
      "forced-colors": "not-applicable",
    });
    expect(
      records.find(({ id }) => id === "en-forced-colors-390x844")?.checks,
    ).toMatchObject({
      "forced-colors": "pass",
      "reduced-motion": "pass",
      "switch-direction": "not-applicable",
      "zoom-200": "not-applicable",
    });
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
    expect(copy.specimenNote).not.toMatch(/ship in Phase 5A\.1b|powstaną w fazie 5A\.1b|folgen in Phase 5A\.1b/iu);
  });

  it("keeps the browser project fail-closed and the artifact outside baseline namespaces", () => {
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
      path.join(process.cwd(), "tooling", "design-system", "catalog", "verify-candidates.mts"),
      "utf8",
    );
    const catalogDirectory = path.join(
      process.cwd(),
      "src",
      "app",
      "dev",
      "components",
      "catalog",
    );
    const catalogSources = readdirSync(catalogDirectory)
      .filter((filename) => filename.endsWith(".tsx") || filename === "catalog.css")
      .sort()
      .map((filename) => readFileSync(path.join(catalogDirectory, filename), "utf8"))
      .join("\n");

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
    expect(runner).toContain('path.join(catalogToolingDirectory, "verify-candidates.mts")');
    expect(specification).toContain('from "./fixtures/safe-test"');
    expect(specification).toContain("new AxeBuilder({ page }).analyze()");
    expect(specification).not.toContain(".exclude(");
    expect(specification).not.toContain(".disableRules(");
    expect(specification).toContain("phase5a1-catalog-candidates");
    expect(specification).toContain("phase5a1-catalog-diagnostics");
    expect(specification).toContain('schemaVersion: 3');
    expect(specification).toContain('kind: "phase5a1b-canonical-primitives-catalog-candidates"');
    expect(specification).toContain("interactionCaptureCount");
    expect(specification).toContain("resilienceCaptureCount");
    expect(specification).toContain("evidenceRecordCount");
    expect(specification).toContain("PHASE5A1_CATALOG_SOURCE_SHA");
    expect(specification).toContain("PHASE5A1_CATALOG_PR_HEAD_SHA");
    expect(specification).toContain("sourceTreeSha");
    expect(specification).toContain("sourceWorktreeSha");
    expect(specification).toContain("data-ds-portal-root");
    expect(specification).toContain("exerciseNestedMenu");
    expect(specification).toContain("nested-outside-cascade-invalid");
    expect(specification).toContain('toHaveAttribute("role", "menuitemcheckbox")');
    expect(specification).toContain('toHaveAttribute("aria-checked", "false")');
    expect(specification).toContain("assertFocusNotObscured");
    expect(specification).toContain("assertMinimumTargetSizes");
    expect(specification).toContain("switchThumbShift");
    expect(specification).toContain("TEXT_SPACING_STYLE");
    expect(specification).toContain("assertZoom200Reflow");
    expect(specification).toContain("assertNoClippedOverlappingOrObscuredContent");
    expect(specification).not.toContain("toHaveScreenshot");
    expect(specification).not.toContain("__screenshots__");
    expect(verifier).toContain("getCatalogCandidateRelativePaths");
    expect(verifier).toContain("candidate-entry-symlink");
    expect(verifier).toContain("candidate-root-contents-invalid");
    expect(verifier).toContain("candidate-manifest-path-matrix-invalid");
    expect(verifier).toContain("candidate-manifest-format-invalid");
    expect(verifier).toContain("candidate-png-signature-invalid");
    expect(verifier).toContain("candidate-evidence-contract-invalid");
    expect(verifier).toContain('manifest.schemaVersion !== 3');
    expect(catalogSources).not.toContain('from "lucide-react"');
    expect(catalogSources).toContain('type: "checkbox"');
    expect(catalogSources).toContain("checked: menuCheckboxChecked");
    for (const retiredReplica of [
      "catalog-v2-button",
      "catalog-v2-icon-button",
      "catalog-v2-field",
      "catalog-v2-switch",
      "catalog-v2-checkbox",
      "catalog-v2-tooltip-pair",
    ]) {
      expect(catalogSources).not.toContain(retiredReplica);
    }
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
