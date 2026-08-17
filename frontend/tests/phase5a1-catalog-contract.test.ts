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
    const catalogStyles = readFileSync(path.join(catalogDirectory, "catalog.css"), "utf8");
    const fieldStyles = readFileSync(
      path.join(process.cwd(), "src", "design-system", "primitives", "Field", "field.module.css"),
      "utf8",
    );
    const comboboxStyles = readFileSync(
      path.join(
        process.cwd(),
        "src",
        "design-system",
        "primitives",
        "Combobox",
        "combobox.module.css",
      ),
      "utf8",
    );
    const comboboxForcedColors = comboboxStyles.slice(
      comboboxStyles.indexOf("@media (forced-colors: active)"),
    );
    const menuStyles = readFileSync(
      path.join(
        process.cwd(),
        "src",
        "design-system",
        "primitives",
        "Menu",
        "menu.module.css",
      ),
      "utf8",
    );
    const menuForcedColors = menuStyles.slice(
      menuStyles.indexOf("@media (forced-colors: active)"),
    );
    const overlayStyles = readFileSync(
      path.join(
        process.cwd(),
        "src",
        "design-system",
        "primitives",
        "Overlay",
        "overlay.module.css",
      ),
      "utf8",
    );
    const overlayForcedColors = overlayStyles.slice(
      overlayStyles.indexOf("@media (forced-colors: active)"),
    );
    const overlaySource = readFileSync(
      path.join(
        process.cwd(),
        "src",
        "design-system",
        "primitives",
        "Overlay",
        "Overlay.tsx",
      ),
      "utf8",
    );
    const axeNodeFingerprintContract = specification.slice(
      specification.indexOf("interface AxeNodeFingerprint"),
      specification.indexOf("class CatalogFailure"),
    );
    const axeDiagnosticHelper = specification.slice(
      specification.indexOf("async function assertFullPageAxe"),
      specification.indexOf("async function assertNoOverflow"),
    );
    const contentIntegrityHelper = specification.slice(
      specification.indexOf("async function assertNoClippedOverlappingOrObscuredContent"),
      specification.indexOf("async function assertTextSpacing"),
    );
    const modalExercise = specification.slice(
      specification.indexOf("async function exerciseModal"),
      specification.indexOf("async function exerciseMenu"),
    );
    const menuExercise = specification.slice(
      specification.indexOf("async function exerciseMenu"),
      specification.indexOf("async function exerciseTabs"),
    );
    const menuTooltipPointerIsolation = menuExercise.slice(
      menuExercise.indexOf("const tooltipTrigger = page.locator("),
      menuExercise.indexOf("await pointerOutside(page, context.pointer);"),
    );
    const overlayRestoreCleanup = overlaySource.slice(
      overlaySource.indexOf("const restoreTarget = explicitRestoreTarget ?? invoker;"),
      overlaySource.indexOf("}, [initialFocus, initialFocusRef, invoker, restoreFocusRef]);"),
    );
    const pointerActivationHelper = specification.slice(
      specification.indexOf("async function pointerActivate"),
      specification.indexOf("async function pointerOpen"),
    );
    const scrollQuiescenceHelper = specification.slice(
      specification.indexOf("async function armCatalogScrollProbe"),
      specification.indexOf("async function pointerActivate"),
    );
    const comboboxDiagnosticHelper = specification.slice(
      specification.indexOf("function normalizeCatalogAttributeState"),
      specification.indexOf("async function exerciseNestedMenu"),
    );
    const retainedDiagnosticHelper = specification.slice(
      specification.indexOf("async function retainSafeDiagnostic"),
      specification.indexOf("for (const viewport of CATALOG_CAPTURE_VIEWPORTS)"),
    );
    const pointerOpenHelper = specification.slice(
      specification.indexOf("async function pointerOpen"),
      specification.indexOf("async function pointerOutside"),
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
    expect(runner).toContain('path.join(catalogToolingDirectory, "verify-candidates.mts")');
    expect(specification).toContain('from "./fixtures/safe-test"');
    expect(specification).toContain("new AxeBuilder({ page }).analyze()");
    expect(specification).not.toContain(".exclude(");
    expect(specification).not.toContain(".disableRules(");
    expect(
      [...axeNodeFingerprintContract.matchAll(/readonly ([a-zA-Z]+):/gu)].map(
        (match) => match[1],
      ),
    ).toEqual([
      "tag",
      "role",
      "component",
      "part",
      "foreground",
      "background",
      "contrastRatio",
      "expectedContrastRatio",
    ]);
    expect(axeDiagnosticHelper).toContain(
      "nodes.map((node, index): AxeNodeFingerprint =>",
    );
    expect(axeDiagnosticHelper).toContain("axeNodeFingerprints: fingerprints");
    expect(axeDiagnosticHelper).toContain('/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/u');
    expect(axeDiagnosticHelper).toContain("value >= 1 && value <= 21");
    for (const forbiddenAxeDiagnosticField of [
      ".html",
      ".xpath",
      ".ancestry",
      ".failureSummary",
      ".message",
      ".helpUrl",
      ".textContent",
      ".innerText",
      ".innerHTML",
      ".outerHTML",
      ".className",
      'getAttribute("id")',
      'getAttribute("class")',
      "aria-label",
      "accessibleName",
    ]) {
      expect(axeDiagnosticHelper).not.toContain(forbiddenAxeDiagnosticField);
    }
    expect(modalExercise).toMatch(
      /await page\.keyboard\.press\("Escape"\);\s*await expect\(content\)\.toBeHidden\(\);\s*try \{\s*await expect\(trigger\)\.toBeFocused\(\{ timeout: 1_000 \}\);/u,
    );
    expect(modalExercise).toMatch(
      /await pointerOutside\(page, context\.pointer\);\s*await expect\(content\)\.toBeHidden\(\);\s*try \{\s*await expect\(trigger\)\.toBeFocused\(\{ timeout: 1_000 \}\);/u,
    );
    expect(
      modalExercise.match(
        /await expect\(trigger\)\.toBeFocused\(\{ timeout: 1_000 \}\);/gu,
      ),
    ).toHaveLength(2);
    expect(
      modalExercise.match(
        /throw new CatalogFailure\("focus-restoration-invalid", capture\)/gu,
      ),
    ).toHaveLength(2);
    expect(modalExercise).not.toContain(
      "trigger.evaluate((element) => element === document.activeElement)",
    );
    expect(modalExercise).not.toContain("await expect(trigger).toBeFocused();");
    expect(overlayRestoreCleanup).toContain(
      "const ownerDocument = restoreTarget.ownerDocument;",
    );
    expect(overlayRestoreCleanup).toContain("setTimeout(() => {");
    expect(overlayRestoreCleanup).toMatch(
      /activeElement === ownerDocument\.body \|\| activeElement === invoker/u,
    );
    expect(overlayRestoreCleanup).toContain("focusElement(restoreTarget);");
    expect(overlayRestoreCleanup).toContain("}, 0);");
    expect(overlayRestoreCleanup).not.toContain("queueMicrotask");
    expect(overlayRestoreCleanup).not.toContain("closeReasonRef");
    let tooltipPointerIsolationCursor = 0;
    const tooltipPointerIsolationSteps = [
      "const tooltipTrigger = page.locator(",
      "const tooltip = page.locator(",
      "await expect(tooltipTrigger).toBeFocused();",
      "await expect(tooltip).toBeVisible();",
      'await page.keyboard.press("Escape");',
      "await expect(tooltip).toBeHidden();",
      "await expect(tooltipTrigger).toBeFocused();",
      'throw new CatalogFailure("interaction-contract-invalid", capture);',
      "await pointerOpen(page, trigger, menu, context.pointer, capture);",
    ].map((step) => {
      const index = menuTooltipPointerIsolation.indexOf(step, tooltipPointerIsolationCursor);
      tooltipPointerIsolationCursor = index + step.length;
      return index;
    });
    expect(tooltipPointerIsolationSteps.every((index) => index >= 0)).toBe(true);
    expect(tooltipPointerIsolationSteps).toEqual(
      [...tooltipPointerIsolationSteps].sort((left, right) => left - right),
    );
    expect(menuTooltipPointerIsolation).toMatch(
      /throw new CatalogFailure\("interaction-contract-invalid", capture\);\s*\}\s*await pointerOpen\(page, trigger, menu, context\.pointer, capture\);/u,
    );
    expect(
      menuTooltipPointerIsolation.match(
        /await pointerOpen\(page, trigger, menu, context\.pointer, capture\);/gu,
      ),
    ).toHaveLength(1);
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
    expect(scrollQuiescenceHelper).toContain(
      'document.addEventListener("scroll", observeScroll, true)',
    );
    expect(scrollQuiescenceHelper).toContain(
      'document.removeEventListener("scroll", observeScroll, true)',
    );
    expect(scrollQuiescenceHelper.indexOf("await armCatalogScrollProbe(page)")).toBeLessThan(
      scrollQuiescenceHelper.indexOf("await locator.scrollIntoViewIfNeeded()"),
    );
    expect(scrollQuiescenceHelper).toContain("CATALOG_SCROLL_QUIET_FRAMES_REQUIRED");
    expect(scrollQuiescenceHelper).toContain("CATALOG_SCROLL_QUIESCENCE_TIMEOUT_MS");
    expect(scrollQuiescenceHelper).toContain("cancelAnimationFrame(frame)");
    expect(scrollQuiescenceHelper).toContain(
      'throw new CatalogFailure("scroll-quiescence-invalid", capture, { scroll })',
    );
    expect(scrollQuiescenceHelper).not.toContain("waitForTimeout");
    expect(scrollQuiescenceHelper).not.toMatch(/retry|reopen|force:/u);
    expect(specification).toContain("focus({ preventScroll: true })");
    expect(specification).toContain('"initial-open"');
    expect(specification).toContain('"post-audit"');
    expect(specification).toContain('"post-capture"');
    expect(comboboxDiagnosticHelper).toContain("liveStatusMatchesExpected");
    expect(comboboxDiagnosticHelper).toContain("popupStatusMatchesExpected");
    expect(comboboxDiagnosticHelper).not.toMatch(
      /readonly\s+(?:liveStatus|popupStatus|id|selector|url|text|html)\s*:/iu,
    );
    expect(retainedDiagnosticHelper).toContain("schemaVersion: 3");
    expect(retainedDiagnosticHelper.indexOf("writeFileSync(")).toBeLessThan(
      retainedDiagnosticHelper.indexOf(".screenshot({"),
    );
    expect(pointerActivationHelper).toContain("capture: CatalogFailureCapture");
    expect(pointerActivationHelper).toContain(
      "await prepareCatalogScrollTarget(page, locator, capture)",
    );
    expect(pointerActivationHelper.match(/await locator\.click\(\);/gu)).toHaveLength(1);
    expect(
      pointerActivationHelper.match(
        /await page\.touchscreen\.tap\(box\.x \+ \(box\.width \/ 2\), box\.y \+ \(box\.height \/ 2\)\);/gu,
      ),
    ).toHaveLength(1);
    expect(pointerActivationHelper).toContain(
      'throw new CatalogFailure("pointer-contract-invalid", capture)',
    );
    expect(pointerOpenHelper).toContain("await pointerActivate(page, trigger, pointer, capture)");
    expect(
      pointerOpenHelper.match(
        /await pointerActivate\(page, trigger, pointer, capture\);/gu,
      ),
    ).toHaveLength(1);
    expect(pointerOpenHelper).toContain("await expect(content).toBeVisible()");
    expect(pointerOpenHelper).toContain(
      'throw new CatalogFailure("pointer-contract-invalid", capture)',
    );
    for (const callSite of [
      "await pointerOpen(page, trigger, nestedMenu, context.pointer, capture)",
      "await pointerOpen(page, trigger, content, context.pointer, capture)",
      "await pointerOpen(page, trigger, menu, context.pointer, capture)",
    ]) {
      expect(specification).toContain(callSite);
    }
    expect(
      specification.match(/await pointerActivate\(page, input, context\.pointer, capture\)/gu),
    ).toHaveLength(2);
    expect(specification).toContain("inlineScrollableBoundary");
    expect(specification).toContain("blockScrollableBoundary");
    expect(contentIntegrityHelper).toMatch(
      /const nativeInlineTextTypes = new Set\(\[\s*"email",\s*"password",\s*"search",\s*"tel",\s*"text",\s*"url",\s*\]\);/u,
    );
    expect(contentIntegrityHelper).toMatch(
      /ancestor === element\s*&&\s*element instanceof HTMLInputElement\s*&&\s*!element\.matches\(":disabled"\)\s*&&\s*!element\.readOnly\s*&&\s*element\.value\.length > 0\s*&&\s*nativeInlineTextTypes\.has\(element\.type\)/u,
    );
    expect(contentIntegrityHelper).toContain(
      "(inlineContentOverflows && !isNativeInlineTextViewport) ||",
    );
    expect(contentIntegrityHelper).toContain("blockContentOverflows");
    expect(contentIntegrityHelper).toContain(
      "isNativeInlineTextViewport && inlineContentOverflows",
    );
    expect(contentIntegrityHelper).not.toContain('element.matches("input")');
    expect(specification).toContain(
      '"[data-ds-component]:not(input):not(textarea):not(select)"',
    );
    expect(specification).toContain("overflowTarget");
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
    expect(catalogStyles).toMatch(
      /\.catalog-v2-composite-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/su,
    );
    expect(fieldStyles).toMatch(/\.switchLabel\s*\{[^}]*flex-wrap:\s*wrap;/su);
    expect(fieldStyles).toMatch(/\.switchControl\s*\{[^}]*max-inline-size:\s*100%;/su);
    expect(comboboxForcedColors).toMatch(
      /\.option\[data-active="true"\]\s*\{[^}]*color:\s*HighlightText;[^}]*background:\s*Highlight;[^}]*border-color:\s*Highlight;[^}]*forced-color-adjust:\s*none;/u,
    );
    expect(comboboxForcedColors).toMatch(
      /\.option\[data-active="true"\]:hover\s*\{[^}]*background:\s*Highlight;/u,
    );
    expect(comboboxForcedColors).toMatch(
      /\.option\[data-active="true"\]\s+\.optionDescription\s*\{[^}]*color:\s*HighlightText;/u,
    );
    expect(menuForcedColors).toMatch(
      /\.item\[data-active="true"\]:not\(\[aria-disabled="true"\]\)\s*\{[^}]*color:\s*HighlightText;[^}]*background:\s*Highlight;[^}]*border-color:\s*Highlight;[^}]*forced-color-adjust:\s*none;/u,
    );
    expect(menuForcedColors).toMatch(
      /\.item\[data-active="true"\]\[aria-disabled="true"\]\s*\{[^}]*color:\s*GrayText;[^}]*background:\s*Canvas;[^}]*border-color:\s*Highlight;/u,
    );
    expect(menuForcedColors).not.toMatch(
      /\.item\[data-active="true"\]\[aria-disabled="true"\]\s*\{[^}]*forced-color-adjust:\s*none;/u,
    );
    expect(overlayForcedColors).toMatch(
      /\.overlay::backdrop\s*\{[^}]*animation:\s*none;[^}]*background:\s*Canvas;[^}]*opacity:\s*1;/u,
    );
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
