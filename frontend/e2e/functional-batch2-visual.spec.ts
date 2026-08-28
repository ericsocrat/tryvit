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
      .filter((entry) => entry.width > 0 && (entry.left < -1 || entry.right > viewportWidth + 1))
      .slice(0, 8);
    return {
      overflow: document.documentElement.scrollWidth - viewportWidth,
      offenders,
    };
  });
  expect(result.overflow, JSON.stringify(result.offenders)).toBeLessThanOrEqual(1);
}

async function captureReviewState(page: Page, testInfo: TestInfo, surface: string) {
  for (const viewport of REVIEW_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const theme of ["light", "dark"] as const) {
      await applyTheme(page, theme);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`batch2-${surface}-${viewport.label}-${theme}.png`),
        animations: "disabled",
      });
    }
  }
}

async function collectFixtureProductIds(page: Page): Promise<number[]> {
  const category = process.env.QA_CATEGORY_SLUG ?? "dairy";
  await page.goto(`/app/categories/${category}`);
  const links = page.locator('a[href^="/app/product/"]');
  await expect(links.first()).toBeVisible({ timeout: 15_000 });
  const hrefs = await links.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("href")),
  );
  const ids = [
    ...new Set(
      hrefs
        .map((href) => Number(href?.split("/").pop()))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  expect(ids.length).toBeGreaterThanOrEqual(2);
  return ids.slice(0, 2);
}

async function saveCountryPreference(page: Page, country: "Polska" | "Deutschland") {
  await page.goto("/app/settings");
  await page.getByRole("button", { name: new RegExp(country, "i") }).click();
  const save = page.getByRole("button", {
    name: /Save Changes|Zapisz zmiany|Änderungen speichern/i,
  });
  await expect(save).toBeVisible();
  await save.click();
  await expect(save).not.toBeVisible({ timeout: 10_000 });
}

test.describe("Batch 2 visual journey", () => {
  test("product intelligence, evidence, comparison, watchlist and lists stay coherent", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const [firstProductId, secondProductId] = await collectFixtureProductIds(page);

    await page.goto(`/app/product/${firstProductId}`);
    await expect(page.getByTestId("product-layout")).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .getByTestId("product-evidence-panel")
        .or(page.getByTestId("product-evidence-unavailable")),
    ).toBeVisible({ timeout: 15_000 });
    await captureReviewState(page, testInfo, "product-summary");

    const expand = page.getByTestId("toggle-analysis").first();
    if (await expand.isVisible().catch(() => false)) await expand.click();
    await expect(page.getByTestId("tab-bar")).toBeVisible();
    await page.getByRole("tab", { name: /Nutrition|Odżywianie|Nährwerte/i }).click();
    await expect(page.getByTestId("tab-content")).toBeVisible();
    await captureReviewState(page, testInfo, "product-analysis");

    await page.getByRole("tab", { name: /Alternatives|Alternatywy|Alternativen/i }).click();
    await expect(page.getByTestId("tab-content")).toBeVisible();
    await captureReviewState(page, testInfo, "product-alternatives");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath("batch2-product-alternatives-390-forced-colors.png"),
      animations: "disabled",
    });
    await page.emulateMedia({ forcedColors: "none", reducedMotion: "reduce" });

    await page.goto(`/app/compare?ids=${firstProductId},${secondProductId}`);
    await expect(page.getByTestId("comparison-register")).toBeVisible({ timeout: 15_000 });
    await captureReviewState(page, testInfo, "compare");

    await page.goto("/app/watchlist");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page
        .getByTestId("product-register-card")
        .first()
        .or(page.getByText(/No watched products/i)),
    ).toBeVisible({ timeout: 15_000 });
    await captureReviewState(page, testInfo, "watchlist");

    await page.goto("/app/lists");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await captureReviewState(page, testInfo, "lists");

    await saveCountryPreference(page, "Polska");
    await page.goto(`/app/product/${firstProductId}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);

    await saveCountryPreference(page, "Deutschland");
    await page.goto(`/app/compare?ids=${firstProductId},${secondProductId}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await page.setViewportSize({ width: 1440, height: 900 });
    await applyTheme(page, "dark");
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? null);
    expect(focusedTag).not.toBe("BODY");
  });
});
