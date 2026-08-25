import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";

import { expect, test, type Page, type TestInfo } from "./fixtures/safe-test";

type Theme = "light" | "dark";

interface CaptureCase {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly locale: "en-US" | "pl-PL" | "de-DE";
  readonly language: "en" | "pl" | "de";
  readonly theme: Theme;
  readonly textSpacing?: boolean;
  readonly forcedColors?: boolean;
}

const CAPTURES: readonly CaptureCase[] = [
  { name: "landing--390x844--light--en.png", width: 390, height: 844, locale: "en-US", language: "en", theme: "light" },
  { name: "landing--390x844--dark--en.png", width: 390, height: 844, locale: "en-US", language: "en", theme: "dark" },
  { name: "landing--768x1024--light--en.png", width: 768, height: 1024, locale: "en-US", language: "en", theme: "light" },
  { name: "landing--768x1024--dark--en.png", width: 768, height: 1024, locale: "en-US", language: "en", theme: "dark" },
  { name: "landing--1440x900--light--en.png", width: 1440, height: 900, locale: "en-US", language: "en", theme: "light" },
  { name: "landing--1440x900--dark--en.png", width: 1440, height: 900, locale: "en-US", language: "en", theme: "dark" },
  // A 1280 CSS-pixel desktop viewport at 200% browser zoom exposes 640 CSS pixels.
  { name: "landing--640x900--200-percent-equivalent--en.png", width: 640, height: 900, locale: "en-US", language: "en", theme: "light" },
  { name: "landing--320x900--reflow--en.png", width: 320, height: 900, locale: "en-US", language: "en", theme: "light" },
  { name: "landing--390x844--forced-colors--en.png", width: 390, height: 844, locale: "en-US", language: "en", theme: "light", forcedColors: true },
];

async function openLanding(page: Page, capture: CaptureCase): Promise<void> {
  await page.setViewportSize({ width: capture.width, height: capture.height });
  await page.addInitScript((theme: Theme) => localStorage.setItem("theme", theme), capture.theme);
  await page.emulateMedia({
    colorScheme: capture.theme,
    reducedMotion: "reduce",
    forcedColors: capture.forcedColors ? "active" : "none",
  });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveAttribute("lang", capture.language);
  await expect(page.locator('[data-landing-shell="folded-label-register"]')).toBeVisible();
  if (capture.textSpacing) {
    await page.addStyleTag({
      content: `
        * { letter-spacing: 0.12em !important; line-height: 1.5 !important; word-spacing: 0.16em !important; }
        p { margin-bottom: 2em !important; }
      `,
    });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    capture.width,
  );
}

for (const capture of CAPTURES) {
  test(`retains ${capture.name}`, async ({ page }, testInfo: TestInfo) => {
    await openLanding(page, capture);
    await page.screenshot({ path: testInfo.outputPath(capture.name), animations: "disabled" });
  });
}

test("has zero backend traffic and retains the system font fallback", async ({ page }) => {
  const forbidden: string[] = [];
  const fontResponses = new Map<string, number>();
  const imageRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      /\/(?:auth|rest|realtime|storage|functions|graphql)\/v1(?:\/|$)/iu.test(url.pathname) ||
      url.pathname === "/api/flags"
    ) {
      forbidden.push(`${request.method()} ${url.pathname}`);
    }
    if (request.resourceType() === "image") imageRequests.push(url.pathname);
  });
  page.on("response", async (response) => {
    if (/\.woff2(?:\?|$)/u.test(response.url())) {
      fontResponses.set(new URL(response.url()).pathname, (await response.body()).byteLength);
    }
  });

  await openLanding(page, CAPTURES[0]);
  await page.waitForLoadState("networkidle");
  expect(forbidden).toEqual([]);
  expect(imageRequests).toEqual([]);
  expect([...fontResponses.values()]).toEqual([]);
});

test("does not load candidate fonts on authentication", async ({ page }) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (/\.woff2(?:\?|$)/u.test(request.url())) fontRequests.push(request.url());
  });
  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");
  expect(fontRequests).toEqual([]);
});

test("passes full-page Axe without exclusions or disabled rules", async ({ page }) => {
  await openLanding(page, CAPTURES[0]);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("retains keyboard order and visible skip navigation", async ({ page }) => {
  await openLanding(page, CAPTURES[0]);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("href", "#main-content");
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("href", "#evidence");
});

test("records zero animation-attributable long tasks and layout shift", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const evidence = { cls: 0, longTasks: [] as Array<{ startTime: number; duration: number }> };
    Object.defineProperty(globalThis, "__phase5a3MotionEvidence", {
      configurable: true,
      value: evidence,
    });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        evidence.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
      }
    }).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntryList & Array<{ value: number; hadRecentInput: boolean }>) {
        if (!entry.hadRecentInput) evidence.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const startTime = await page.evaluate(() => performance.now());
  const narrative = page.locator('main button[aria-expanded]');
  await narrative.click();
  await page.waitForTimeout(650);
  const endTime = await page.evaluate(() => performance.now());
  const captured = await page.evaluate(() => {
    const value = (
      globalThis as typeof globalThis & {
        __phase5a3MotionEvidence: {
          cls: number;
          longTasks: Array<{ startTime: number; duration: number }>;
        };
      }
    ).__phase5a3MotionEvidence;
    return { cls: value.cls, longTasks: value.longTasks };
  });
  const attributable = captured.longTasks.filter(
    (task) => task.startTime <= endTime && task.startTime + task.duration >= startTime,
  );
  expect(captured.cls).toBeLessThanOrEqual(0.05);
  expect(attributable.filter((task) => task.duration > 50)).toEqual([]);
  await writeFile(
    testInfo.outputPath("landing-motion-performance.json"),
    `${JSON.stringify({ startTime, endTime, ...captured, animationAttributableLongTasks: attributable }, null, 2)}\n`,
    "utf8",
  );
});
