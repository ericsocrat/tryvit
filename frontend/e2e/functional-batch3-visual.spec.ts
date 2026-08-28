import { expect, test, type Page, type TestInfo } from "./fixtures/safe-test";
import { assertNoA11yViolations } from "./helpers/a11y";

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
        path: testInfo.outputPath(`batch3-${surface}-${viewport.label}-${theme}.png`),
        animations: "disabled",
      });
    }
  }
}

async function collectFixtureProductId(page: Page): Promise<number> {
  await page.goto("/app/search");
  const search = page.getByRole("combobox", { name: /search products/i });
  await search.fill("QA");
  await page.waitForTimeout(450);
  await search.press("Escape");
  const link = page.getByTestId("product-register-card").first().locator("a");
  await expect(link).toBeVisible({ timeout: 15_000 });
  const href = await link.getAttribute("href");
  const productId = Number(href?.split("/").pop());
  expect(Number.isInteger(productId) && productId > 0).toBe(true);
  return productId;
}

async function saveLocalePreference(
  page: Page,
  country: "Polska" | "Deutschland",
  language: "Polski" | "Deutsch",
  languageCode: "pl" | "de",
) {
  await page.goto("/app/settings");
  await page.getByRole("button", { name: new RegExp(country, "i") }).click();
  await page.getByRole("button", { name: new RegExp(`^${language}$`, "i") }).click();
  const save = page.getByRole("button", {
    name: /Save Changes|Zapisz zmiany|Änderungen speichern/i,
  });
  await expect(save).toBeVisible();
  await save.click();
  await expect(save).not.toBeVisible({ timeout: 10_000 });
  await expect(page.locator("html")).toHaveAttribute("lang", languageCode);
}

test.describe("Batch 3 remaining customer surfaces", () => {
  test("Scanner, activity, Settings, Learn and legal stay coherent", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    await page.emulateMedia({ reducedMotion: "reduce" });

    const productId = await collectFixtureProductId(page);

    await page.goto("/app/scan");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const manualMode = page.getByRole("button", {
      name: /Manual|Ręcznie|Manuell/i,
    });
    await manualMode.click();
    const barcodeInput = page.getByRole("textbox");
    await expect(barcodeInput).toBeVisible();
    await barcodeInput.focus();
    await expect(barcodeInput).toBeFocused();
    await captureReviewState(page, testInfo, "scanner-manual");
    await assertNoA11yViolations(page);

    await page.goto(`/app/scan/result/${productId}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    await captureReviewState(page, testInfo, "scan-result");

    await page.goto("/app/scan/history");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await captureReviewState(page, testInfo, "scan-history");

    await page.goto("/app/scan/submissions");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await captureReviewState(page, testInfo, "submissions");

    await page.goto("/app/settings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await captureReviewState(page, testInfo, "settings");
    await assertNoA11yViolations(page);

    await page.goto("/learn");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await captureReviewState(page, testInfo, "learn-hub");
    await assertNoA11yViolations(page);

    await page.goto("/learn/confidence");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await captureReviewState(page, testInfo, "learn-confidence");

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await captureReviewState(page, testInfo, "privacy");
    await assertNoA11yViolations(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath("batch3-privacy-390-forced-colors.png"),
      animations: "disabled",
    });
    await page.emulateMedia({ forcedColors: "none", reducedMotion: "reduce" });

    await saveLocalePreference(page, "Polska", "Polski", "pl");
    await page.setExtraHTTPHeaders({
      "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
    });
    await page.goto("/learn");
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);

    await saveLocalePreference(page, "Deutschland", "Deutsch", "de");
    await page.setExtraHTTPHeaders({
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    });
    await page.goto("/terms");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await page.setViewportSize({ width: 1440, height: 900 });
    await applyTheme(page, "dark");
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? null);
    expect(focusedTag).not.toBe("BODY");
  });
});
