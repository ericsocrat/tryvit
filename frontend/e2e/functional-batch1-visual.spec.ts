import { expect, test, type Page, type TestInfo } from "./fixtures/safe-test";

type ReviewTheme = "light" | "dark";

const REVIEW_VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "768", width: 768, height: 1024 },
  { label: "1440", width: 1440, height: 900 },
] as const;

async function applyTheme(page: Page, theme: ReviewTheme) {
  await page.evaluate((nextTheme) => {
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  }, theme);
}

async function expectNoHorizontalOverflow(page: Page) {
  await page.waitForTimeout(50);
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          testId: element.dataset.testid ?? null,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter(
        (entry) =>
          entry.width > 0 &&
          (entry.left < -1 || entry.right > viewportWidth + 1),
      )
      .slice(0, 8);
    return {
      overflow: document.documentElement.scrollWidth - viewportWidth,
      offenders,
    };
  });
  expect(result.overflow, JSON.stringify(result.offenders)).toBeLessThanOrEqual(1);
}

async function captureReviewState(
  page: Page,
  testInfo: TestInfo,
  surface: string,
) {
  for (const viewport of REVIEW_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const theme of ["light", "dark"] as const) {
      await applyTheme(page, theme);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`batch1-${surface}-${viewport.label}-${theme}.png`),
        animations: "disabled",
      });
    }
  }
}

test.describe("Batch 1 visual journey", () => {
  test("shell, Search results, Categories and product records stay coherent", async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/app/search");
    await expect(page.locator('[data-design-system="v2"]')).toBeVisible();

    const search = page.getByRole("combobox", { name: /search products/i });
    await search.fill("QA");
    await page.waitForTimeout(450);
    await search.press("Escape");
    await expect(page.getByTestId("results-container")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("product-register-card").first()).toBeVisible();
    await captureReviewState(page, testInfo, "search-results");

    await page.goto("/app/categories");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await captureReviewState(page, testInfo, "categories");

    await page.goto("/app/categories/dairy");
    await expect(page.getByTestId("product-register-card").first()).toBeVisible({
      timeout: 15_000,
    });
    await captureReviewState(page, testInfo, "category-listing");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("main-navigation")).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId("desktop-sidebar")).toBeVisible();
  });
});
