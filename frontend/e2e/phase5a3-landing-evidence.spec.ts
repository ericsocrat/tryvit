import AxeBuilder from "@axe-core/playwright";

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
