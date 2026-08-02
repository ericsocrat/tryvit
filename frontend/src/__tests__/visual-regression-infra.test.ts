/**
 * Meta-tests for the visual regression infrastructure.
 * Validates that helpers, config, and test files are correctly wired.
 *
 * Issue #70 — Visual Regression Baseline
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/* ── Helper module ───────────────────────────────────────────────────────── */

describe("Visual regression helper (e2e/helpers/visual.ts)", () => {
  it("helper file exists", () => {
    const helperPath = path.resolve(__dirname, "../../e2e/helpers/visual.ts");
    expect(fs.existsSync(helperPath)).toBe(true);
  });

  it("exports assertScreenshot function", async () => {
    // Dynamic import of the TypeScript source isn't possible in Vitest
    // without the E2E tsconfig, so we verify the file content instead.
    const helperPath = path.resolve(__dirname, "../../e2e/helpers/visual.ts");
    const content = fs.readFileSync(helperPath, "utf-8");

    expect(content).toContain("export async function assertScreenshot");
    expect(content).toContain("export function buildTestMatrix");
    expect(content).toContain("export const VIEWPORTS");
    expect(content).toContain("export const THEMES");
  });

  it("assertScreenshot sets viewport and color scheme", () => {
    const helperPath = path.resolve(__dirname, "../../e2e/helpers/visual.ts");
    const content = fs.readFileSync(helperPath, "utf-8");

    expect(content).toContain("setViewportSize");
    expect(content).toContain("emulateMedia");
    expect(content).toContain("colorScheme");
    expect(content).toContain("reducedMotion");
  });

  it("VIEWPORTS includes desktop and mobile", () => {
    const helperPath = path.resolve(__dirname, "../../e2e/helpers/visual.ts");
    const content = fs.readFileSync(helperPath, "utf-8");

    // Desktop: 1280×720
    expect(content).toContain("1280");
    expect(content).toContain("720");
    // Mobile: 375×812
    expect(content).toContain("375");
    expect(content).toContain("812");
  });

  it("THEMES includes light and dark", () => {
    const helperPath = path.resolve(__dirname, "../../e2e/helpers/visual.ts");
    const content = fs.readFileSync(helperPath, "utf-8");

    expect(content).toContain('"light"');
    expect(content).toContain('"dark"');
  });

  it("masks dynamic content to prevent false diffs", () => {
    const helperPath = path.resolve(__dirname, "../../e2e/helpers/visual.ts");
    const content = fs.readFileSync(helperPath, "utf-8");

    expect(content).toContain("mask");
    expect(content).toContain("maskLocators");
  });
});

/* ── Playwright config ───────────────────────────────────────────────────── */

describe("Playwright config (visual regression)", () => {
  it("playwright.config.ts exists", () => {
    const configPath = path.resolve(__dirname, "../../playwright.config.ts");
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it("config includes toHaveScreenshot settings", () => {
    const configPath = path.resolve(__dirname, "../../playwright.config.ts");
    const content = fs.readFileSync(configPath, "utf-8");

    expect(content).toContain("toHaveScreenshot");
    expect(content).toContain("maxDiffPixelRatio");
    expect(content).toContain("animations");
  });

  it("config includes snapshotPathTemplate for __screenshots__", () => {
    const configPath = path.resolve(__dirname, "../../playwright.config.ts");
    const content = fs.readFileSync(configPath, "utf-8");

    expect(content).toContain("snapshotPathTemplate");
    expect(content).toContain("__screenshots__");
  });

  it("config gates visual projects behind VISUAL_REGRESSION env var", () => {
    const configPath = path.resolve(__dirname, "../../playwright.config.ts");
    const content = fs.readFileSync(configPath, "utf-8");

    expect(content).toContain("VISUAL_REGRESSION");
    expect(content).toContain("visual-smoke");
    expect(content).toContain("visual-authenticated");
  });

  it("smoke project excludes visual specs via negative lookahead", () => {
    const configPath = path.resolve(__dirname, "../../playwright.config.ts");
    const content = fs.readFileSync(configPath, "utf-8");

    // Smoke project uses negative lookahead to exclude visual tests
    expect(content).toMatch(/smoke\(\?!.*visual\)/);
  });
});

/* ── Test files ──────────────────────────────────────────────────────────── */

describe("Visual regression test files", () => {
  it("applies the authoritative light and reduced-motion context in the shared helper", () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), "e2e/helpers/visual.ts"), "utf8");

    expect(content).toContain(
      'page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" })',
    );
    expect(content).toContain("safeConsoleErrorCode(message, appOrigin, localServiceOrigin)");
    expect(content).toContain("expect(localServiceFailures).toEqual([])");
    expect(content).not.toContain('consoleErrors.push("console-error")');
  });

  it("smoke-visual.spec.ts exists", () => {
    const specPath = path.resolve(__dirname, "../../e2e/smoke-visual.spec.ts");
    expect(fs.existsSync(specPath)).toBe(true);
  });

  it("authenticated-visual.spec.ts exists", () => {
    const specPath = path.resolve(__dirname, "../../e2e/authenticated-visual.spec.ts");
    expect(fs.existsSync(specPath)).toBe(true);
  });

  it("smoke-visual consumes the authoritative public Phase 5A.0d matrix", () => {
    const specPath = path.resolve(__dirname, "../../e2e/smoke-visual.spec.ts");
    const content = fs.readFileSync(specPath, "utf-8");

    expect(content).toContain("VISUAL_BASELINE_CASES");
    expect(content).toContain('candidate.mode === "public"');
    expect(content).toContain('colorScheme: "light"');
    expect(content).toContain('contextOptions: { reducedMotion: "reduce" }');
    expect(content).toContain("assertPhase5VisualBaseline");
  });

  it("authenticated-visual consumes only the guarded local-authenticated matrix", () => {
    const specPath = path.resolve(__dirname, "../../e2e/authenticated-visual.spec.ts");
    const content = fs.readFileSync(specPath, "utf-8");

    expect(content).toContain("VISUAL_BASELINE_CASES");
    expect(content).toContain('candidate.mode === "local-authenticated"');
    expect(content).toContain('contextOptions: { reducedMotion: "reduce" }');
    expect(content).toContain("assertPhase5VisualBaseline");
    expect(content).toContain("retries: 0");
  });

  it("the authoritative helper prohibits meaningful-content masks", () => {
    const helperPath = path.resolve(__dirname, "../../e2e/helpers/visual.ts");
    const content = fs.readFileSync(helperPath, "utf-8");

    expect(content).toContain("assertNoMeaningfulVisualMasks");
    expect(content).toContain("meaningful-content-masking-prohibited");
    expect(content).toContain("mask: []");
    expect(content).toContain("maxDiffPixelRatio: VISUAL_MAX_DIFF_PIXEL_RATIO");
  });

  it("fails broken first-party images instead of blessing them into a baseline", () => {
    const helperPath = path.resolve(__dirname, "../../e2e/helpers/visual.ts");
    const content = fs.readFileSync(helperPath, "utf-8");

    expect(content).not.toContain('target.pathname.startsWith("/_next/image")');
    expect(content).toContain("image.naturalWidth <= 0");
    expect(content).toContain("image.naturalHeight <= 0");
    expect(content).toContain("await image.decode()");
  });
});

/* ── .gitattributes ──────────────────────────────────────────────────────── */

describe(".gitattributes (screenshot baselines)", () => {
  it(".gitattributes marks screenshots as binary", () => {
    const gaPath = path.resolve(__dirname, "../../.gitattributes");
    expect(fs.existsSync(gaPath)).toBe(true);

    const content = fs.readFileSync(gaPath, "utf-8");
    expect(content).toContain("__screenshots__");
    expect(content).toContain("binary");
  });
});
