// ─── Visual regression screenshot helper ────────────────────────────────────
// Shared utility for deterministic screenshot comparison across light/dark
// themes and viewport sizes.
//
// Issue #70 — Visual Regression Baseline

import type { ConsoleMessage, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type { VisualBaselineCase } from "../../tooling/phase5a0d-contract";
import {
  PHASE5A0D_FIXED_TIME,
  VISUAL_MAX_DIFF_PIXEL_RATIO,
} from "../../tooling/phase5a0d-contract";
import { safePhase5VisualConsoleErrorCode } from "../../tooling/phase5a0d-visual-diagnostics";

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface ScreenshotOptions {
  /** Descriptive name used in the screenshot filename */
  name: string;
  /** Playwright page instance */
  page: Page;
  /** Color scheme to emulate. @default "light" */
  theme?: "light" | "dark";
  /** Viewport size override. @default { width: 1280, height: 720 } */
  viewport?: { width: number; height: number };
  /** CSS selectors to mask (e.g., dynamic content like timestamps) */
  mask?: string[];
  /** Max allowed pixel difference ratio (0–1). @default 0.01 (1%) */
  maxDiffPixelRatio?: number;
  /** Whether to take a full-page screenshot. @default false */
  fullPage?: boolean;
}

/* ── Predefined viewports ────────────────────────────────────────────────── */

export const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 375, height: 812 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

/* ── Predefined themes ───────────────────────────────────────────────────── */

export const THEMES = ["light", "dark"] as const;
export type ThemeName = (typeof THEMES)[number];

async function assertStableViewportImages(page: Page): Promise<void> {
  const failedImageIndexes = await page.evaluate(async () => {
    await document.fonts.ready;
    const visibleViewportImages = [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < innerHeight &&
        rect.left < innerWidth &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });
    const failed: number[] = [];
    await Promise.all(
      visibleViewportImages.map(async (image, index) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 10_000);
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
            image.addEventListener("load", () => clearTimeout(timeout), { once: true });
            image.addEventListener("error", () => clearTimeout(timeout), { once: true });
          });
        }
        try {
          await image.decode();
        } catch {
          failed.push(index);
          return;
        }
        if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
          failed.push(index);
        }
      }),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    window.scrollTo(0, 0);
    return failed.sort((left, right) => left - right);
  });
  expect(failedImageIndexes).toEqual([]);
}

export function assertNoMeaningfulVisualMasks(mask: readonly string[]): void {
  if (mask.length > 0) {
    throw new Error("[P5_VISUAL] meaningful-content-masking-prohibited");
  }
}

function safeConsoleErrorCode(
  message: ConsoleMessage,
  appOrigin: string,
  localServiceOrigin: string | null,
): string {
  return safePhase5VisualConsoleErrorCode({
    text: message.text(),
    sourceUrl: message.location().url,
    appOrigin,
    localServiceOrigin,
  });
}

/**
 * Captures one of the seven Phase 5A.0d baselines. Context-level locale,
 * viewport, theme and motion are applied by `test.use` before this receives a
 * page. This helper owns the remaining deterministic state and never masks UI.
 */
export async function assertPhase5VisualBaseline(
  page: Page,
  baseline: VisualBaselineCase,
): Promise<void> {
  assertNoMeaningfulVisualMasks([]);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date(PHASE5A0D_FIXED_TIME));
  await page.addInitScript(() => {
    localStorage.setItem("theme", "light");
  });

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const firstPartyFailures: number[] = [];
  const localServiceFailures: number[] = [];
  const appOrigin = new URL(process.env.VISUAL_SAFETY_APP_ORIGIN ?? "http://127.0.0.1:3000").origin;
  const localServiceOrigin = process.env.VISUAL_SAFETY_SUPABASE_ORIGIN
    ? new URL(process.env.VISUAL_SAFETY_SUPABASE_ORIGIN).origin
    : null;
  page.on("pageerror", (error) => pageErrors.push(error.name || "Error"));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(safeConsoleErrorCode(message, appOrigin, localServiceOrigin));
    }
  });
  page.on("response", (response) => {
    const target = new URL(response.url());
    if (target.origin === appOrigin && response.status() >= 400) {
      firstPartyFailures.push(response.status());
    }
    if (target.origin === localServiceOrigin && response.status() >= 400) {
      localServiceFailures.push(response.status());
    }
  });

  const navigation = await page.goto(baseline.path, { waitUntil: "load" });
  expect(navigation?.ok()).toBe(true);
  expect(new URL(page.url()).pathname).toBe(baseline.path);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  if (baseline.routeId === "landing") {
    await expect(page.locator("#main-content h1")).toBeVisible();
    await expect(page.locator("#service-status-heading")).toBeAttached();
  } else if (baseline.routeId === "login") {
    await expect(page.locator("#main-content h1")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  } else {
    await expect(page.getByTestId("new-user-welcome")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("error-boundary-page")).toHaveCount(0);
  }

  await assertStableViewportImages(page);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(firstPartyFailures).toEqual([]);
  expect(localServiceFailures).toEqual([]);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  );

  await expect(page).toHaveScreenshot(baseline.filename, {
    animations: "disabled",
    fullPage: false,
    mask: [],
    maxDiffPixelRatio: VISUAL_MAX_DIFF_PIXEL_RATIO,
    threshold: 0.2,
  });
}

/* ── Core screenshot assertion ───────────────────────────────────────────── */

/**
 * Takes a deterministic screenshot and compares against baseline.
 *
 * - Sets viewport size
 * - Emulates color scheme (light/dark)
 * - Disables animations via `prefers-reduced-motion: reduce`
 * - Waits for network idle + DOM stability
 * - Masks dynamic content to avoid false positives
 *
 * On first run with no baseline, the screenshot is created as the baseline.
 * Subsequent runs compare against the stored baseline.
 */
export async function assertScreenshot(options: ScreenshotOptions) {
  const {
    name,
    page,
    theme = "light",
    viewport = VIEWPORTS.desktop,
    mask = [],
    maxDiffPixelRatio = 0.01,
    fullPage = false,
  } = options;

  // Set viewport
  await page.setViewportSize(viewport);

  // Set color scheme + disable animations for deterministic screenshots
  await page.emulateMedia({
    colorScheme: theme,
    reducedMotion: "reduce",
  });

  // Wait for fonts and images to load
  await page.waitForLoadState("networkidle");

  // Brief pause for any CSS transitions to settle
  await page.waitForTimeout(300);

  // Build mask locators from CSS selectors
  const maskLocators = mask.map((sel) => page.locator(sel));

  // Construct deterministic filename:
  // e.g. "home-light-1280x720.png"
  const screenshotName = `${name}-${theme}-${viewport.width}x${viewport.height}.png`;

  await expect(page).toHaveScreenshot(screenshotName, {
    maxDiffPixelRatio,
    mask: maskLocators,
    animations: "disabled",
    fullPage,
  });
}

/* ── Batch helper ────────────────────────────────────────────────────────── */

export interface PageConfig {
  /** Page name (used in screenshot filename) */
  name: string;
  /** Route to navigate to */
  path: string;
  /** CSS selectors to mask (dynamic content) */
  mask?: string[];
  /** Wait for this selector before taking screenshot */
  waitFor?: string;
}

/**
 * Generates a matrix of test configurations for all combinations
 * of pages × themes × viewports.
 */
export function buildTestMatrix(pages: PageConfig[]) {
  const matrix: Array<{
    page: PageConfig;
    theme: ThemeName;
    viewportName: ViewportName;
    viewport: { width: number; height: number };
    testName: string;
  }> = [];

  for (const pageConfig of pages) {
    for (const theme of THEMES) {
      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        matrix.push({
          page: pageConfig,
          theme,
          viewportName: viewportName as ViewportName,
          viewport,
          testName: `${pageConfig.name} — ${theme} — ${viewportName}`,
        });
      }
    }
  }

  return matrix;
}
