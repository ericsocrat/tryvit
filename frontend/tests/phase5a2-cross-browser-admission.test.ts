import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = existsSync(path.join(process.cwd(), ".github"))
  ? process.cwd()
  : path.resolve(process.cwd(), "..");
const frontendRoot = path.join(repositoryRoot, "frontend");
const readFrontend = (filename: string): string =>
  readFileSync(path.join(frontendRoot, filename), "utf8");
const readRepository = (filename: string): string =>
  readFileSync(path.join(repositoryRoot, filename), "utf8");

const config = readFrontend("playwright.config.ts");
const specification = readFrontend("e2e/phase5a2-cross-browser-primitives.spec.ts");
const overlayProbes = readFrontend(
  "src/app/dev/components/catalog/OverlayNavigationProbes.client.tsx",
);
const comboboxProbe = readFrontend(
  "src/app/dev/components/catalog/CatalogCombobox.client.tsx",
);
const runner = readFrontend("tooling/design-system/cross-browser/run.mts");
const packageManifest = JSON.parse(readFrontend("package.json")) as {
  readonly scripts: Readonly<Record<string, string>>;
};
const qualityGate = readRepository(".github/workflows/quality-gate.yml");
const nightly = readRepository(".github/workflows/nightly.yml");

describe("Phase 5A.2 cross-browser admission contract", () => {
  it("keeps Firefox and WebKit behavior proof opt-in, local, and artifact-free", () => {
    expect(config).toContain('const HAS_PHASE5A2_CROSS_BROWSER = enabled("PHASE5A2_CROSS_BROWSER")');
    expect(config).toContain('name: "phase5a2-primitives-firefox"');
    expect(config).toContain('browserName: "firefox" as const');
    expect(config).toContain('name: "phase5a2-primitives-webkit"');
    expect(config).toContain('browserName: "webkit" as const');
    expect(config).toContain(
      "[phase5a2PrimitivesFirefoxProject, phase5a2PrimitivesWebkitProject]",
    );

    const projectSource = config.slice(
      config.indexOf("const phase5a2PrimitivesFirefoxProject"),
      config.indexOf("const privatePwaCacheProject"),
    );
    expect(projectSource.match(/dependencies: \["auth-setup"\]/gu)).toHaveLength(2);
    expect(projectSource.match(/retries: 0/gu)).toHaveLength(2);
    expect(projectSource.match(/serviceWorkers: "block"/gu)).toHaveLength(2);
    expect(projectSource.match(/trace: "off"/gu)).toHaveLength(2);
    expect(projectSource.match(/screenshot: "off"/gu)).toHaveLength(2);
    expect(projectSource.match(/video: "off"/gu)).toHaveLength(2);
  });

  it("runs five shared semantic journeys without extending the catalog artifact matrix", () => {
    expect(specification).toContain('from "./fixtures/safe-test"');
    expect(specification.match(/\btest\("/gu)).toHaveLength(5);
    for (const primitive of ["Dialog", "Sheet", "Menu", "Combobox", "Tabs"]) {
      expect(specification).toContain(`test("${primitive}`);
    }
    for (const behavior of [
      'keyboard.press("Tab")',
      'keyboard.press("Shift+Tab")',
      'keyboard.press("Escape")',
      'keyboard.press("ArrowDown")',
      'keyboard.press("ArrowRight")',
      'keyboard.press("Space")',
      'keyboard.press("Enter")',
      'setAttribute("dir", "rtl")',
      'forcedColors: "active"',
      'reducedMotion: "reduce"',
      "expectReducedMotion(tabs)",
      "expectForcedColorEquivalent(page, tabs)",
      'data-ds-overlay-host',
      'aria-expanded',
      'aria-selected',
      'aria-checked',
    ]) {
      expect(specification).toContain(behavior);
    }
    for (const forbidden of [
      "node:fs",
      "sharp",
      "capture-contract",
      "screenshot(",
      "toHaveScreenshot",
      "phase5a1-catalog-candidates",
      "phase5a1-catalog-diagnostics",
      "error.message",
      "message.text()",
    ]) {
      expect(specification).not.toContain(forbidden);
    }
    expect(specification).toContain('errors.push("pageerror")');
    expect(specification).toContain('errors.push("console-error")');
    expect(overlayProbes).toContain("ref={dialogRestoreFocusRef}");
    expect(overlayProbes).toContain("restoreFocusRef={dialogRestoreFocusRef}");
    expect(overlayProbes).toContain("ref={sheetRestoreFocusRef}");
    expect(overlayProbes).toContain("restoreFocusRef={sheetRestoreFocusRef}");
    expect(overlayProbes).toContain("open={menuOpen}");
    expect(overlayProbes).toContain("onOpenChange={setMenuOpen}");
    expect(overlayProbes).toContain("value={tabValue}");
    expect(overlayProbes).toContain("onValueChange={setTabValue}");
    expect(comboboxProbe).toContain("open={open}");
    expect(comboboxProbe).toContain("onOpenChange={setOpen}");
    expect(comboboxProbe).toContain("value={value}");
    expect(comboboxProbe).toContain("onValueChange={setValue}");
  });

  it("provides one guarded local runner for both engines", () => {
    expect(packageManifest.scripts["phase5:cross-browser"]).toContain(
      "tooling/design-system/cross-browser/run.mts",
    );
    expect(runner).toContain('NEXT_PUBLIC_QA_MODE: "1"');
    expect(runner).toContain('PHASE5A1_CATALOG: "1"');
    expect(runner).toContain('PHASE5A2_CROSS_BROWSER: "true"');
    expect(runner).toContain('"local-authenticated"');
    expect(runner).toContain('"--project=phase5a2-primitives-firefox"');
    expect(runner).toContain('"--project=phase5a2-primitives-webkit"');
    expect(runner).not.toContain("verify-candidates.mts");
  });

  it("installs every engine in salted CI caches and keeps proof outside catalog uploads", () => {
    for (const workflow of [qualityGate, nightly]) {
      expect(workflow).toContain('PHASE5A2_CROSS_BROWSER: "true"');
      expect(workflow).toContain("npx playwright install --with-deps chromium firefox webkit");
      expect(workflow).toContain("npx playwright install-deps chromium firefox webkit");
      expect(workflow).toContain("--project=phase5a2-primitives-firefox");
      expect(workflow).toContain("--project=phase5a2-primitives-webkit");
      expect(workflow).not.toMatch(/phase5a2[^\n]*(?:upload-artifact|artifact)/iu);
    }
    expect(qualityGate).toContain("key: playwright-all-engines-");
    expect(nightly).toContain("key: pw-all-engines-");
  });
});
