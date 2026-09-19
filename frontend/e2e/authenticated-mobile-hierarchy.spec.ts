import { expect, test, type Page, type TestInfo } from "./fixtures/safe-test";
import { assertNoA11yViolations } from "./helpers/a11y";
import { getAdminClient, getScopedTestSession } from "./helpers/test-user";
import { loadSafetyContractFromEnvironment } from "./helpers/visual-safety";
import { translate } from "@/lib/i18n-core";

const safety = loadSafetyContractFromEnvironment(process.env);
if (safety.mode !== "local-authenticated") {
  throw new Error("Mobile hierarchy review requires guarded local authentication");
}

const ids = (process.env.EVIDENCE_UI_PRODUCT_IDS ?? "")
  .split(",")
  .filter(Boolean)
  .map(Number);
const pair = ids.slice(0, 2);

async function setLanguage(language: "en" | "pl" | "de") {
  const { userId } = await getScopedTestSession("authenticated");
  const { error } = await getAdminClient()
    .from("user_preferences")
    .update({ preferred_language: language })
    .eq("user_id", userId);
  if (error) throw new Error("Could not set disposable fixture language");
}

async function capture(page: Page, info: TestInfo, name: string, reset = true) {
  if (reset) await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  const screenshotPath = info.outputPath(`${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false, animations: "disabled" });
  await info.attach(name, { path: screenshotPath, contentType: "image/png" });
}

test.describe("mobile Find and Compare hierarchy", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(ids.every((id) => Number.isSafeInteger(id) && id > 0)).toBe(true);
    await setLanguage("pl");
  });

  test.afterAll(async () => {
    await setLanguage("en");
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
  });

  test("puts the first useful Find result in the initial mobile task area", async ({ page }, info) => {
    await page.goto("/app/search?q=QA", { waitUntil: "domcontentloaded" });
    const firstResult = page.getByTestId("product-register-card").first();
    await expect(firstResult).toBeVisible();
    await capture(page, info, "find-390-initial");

    const resultBounds = await firstResult.boundingBox();
    expect(resultBounds).not.toBeNull();
    console.log(`[HIERARCHY] find_first_result_y=${resultBounds!.y.toFixed(2)}`);
    expect(resultBounds!.y).toBeLessThan(650);
    await expect(page.getByRole("button", {
      name: translate("pl", "findUi.filtersButton", { count: 0 }),
    })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("shows two-product Compare facts without horizontal navigation", async ({ page }, info) => {
    await page.goto(`/app/compare?ids=${pair.join(",")}`, { waitUntil: "domcontentloaded" });
    const primary = page.getByTestId("primary-comparison");
    const facts = page.getByTestId("first-comparison-facts");
    await expect(facts).toBeVisible();
    await capture(page, info, "compare-390-initial");

    const factsBounds = await facts.boundingBox();
    expect(factsBounds).not.toBeNull();
    console.log(`[HIERARCHY] compare_first_fact_y=${factsBounds!.y.toFixed(2)}`);
    expect(factsBounds!.y).toBeLessThan(575);
    expect(await primary.evaluate((node) => node.scrollWidth)).toBeLessThanOrEqual(
      await primary.evaluate((node) => node.clientWidth),
    );
    await expect(page.getByText(translate("pl", "evidenceUi.basis.per_100g")).first()).toBeVisible();
    await expect(page.getByText(translate("pl", "evidenceUi.summary.legacy_unverified"))).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/zdrowsz|healthier/iu);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  for (const language of ["pl", "en", "de"] as const) {
    test(`${language}: mobile copy, disclosure and comparison stay usable`, async ({ page }) => {
      await setLanguage(language);
      await page.goto("/app/search?q=QA", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("product-register-card").first()).toBeVisible();
      const context = page.locator("main details").filter({
        hasText: translate(language, "findUi.marketContext", { country: "PL" }),
      }).first();
      const summary = context.locator("summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(context).toHaveAttribute("open", "");
      await expect(page.getByText(translate(language, "findUi.preferenceContext"))).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(context).not.toHaveAttribute("open");

      const filter = page.getByRole("button", {
        name: translate(language, "findUi.filtersButton", { count: 0 }),
      });
      await filter.click();
      await expect(page.getByRole("dialog", { name: translate(language, "findUi.filtersTitle") })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(filter).toBeFocused();

      await page.goto(`/app/compare?ids=${pair.join(",")}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("first-comparison-facts")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      if (language === "pl") {
        const audit = await assertNoA11yViolations(page);
        expect(audit.blocking).toHaveLength(0);
      }
    });
  }

  test("390, 768 and 1440 visual controls preserve evidence access", async ({ page }, info) => {
    await setLanguage("pl");
    await page.goto(`/app/compare?ids=${pair.join(",")}`, { waitUntil: "domcontentloaded" });
    const sources = page.getByTestId("product-sources").last();
    await sources.locator("summary").click();
    await expect(sources).toHaveAttribute("open", "");
    await sources.locator("summary").evaluate((node) => node.scrollIntoView({ block: "center" }));
    await capture(page, info, "compare-390-evidence", false);

    const navigation = page.getByTestId("main-navigation");
    const sourceBounds = await sources.locator("summary").boundingBox();
    const navBounds = await navigation.boundingBox();
    expect(sourceBounds).not.toBeNull();
    expect(navBounds).not.toBeNull();
    expect(sourceBounds!.y + sourceBounds!.height).toBeLessThanOrEqual(navBounds!.y);

    for (const viewport of [
      { width: 768, height: 1024, name: "compare-768" },
      { width: 1440, height: 900, name: "compare-1440" },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/app/compare?ids=${pair.join(",")}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("table", { name: translate("pl", "evidenceUi.compareTable") })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await capture(page, info, viewport.name);
    }
  });

  test("three-product mobile comparison keeps an explicit keyboard-scrollable table", async ({ page }) => {
    test.skip(ids.length < 3, "A third disposable fixture is required");
    await setLanguage("pl");
    await page.goto(`/app/compare?ids=${ids.join(",")}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(translate("pl", "evidenceUi.comparisonScrollHint"))).toBeVisible();
    const region = page.getByRole("region", { name: translate("pl", "evidenceUi.compareTable") });
    await expect(region).toBeVisible();
    await region.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => region.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("dark mobile Find and Compare retain the corrected hierarchy", async ({ page }, info) => {
    await setLanguage("pl");
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto("/app/search?q=QA", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const firstResult = page.getByTestId("product-register-card").first();
    await expect(firstResult).toBeVisible();
    expect((await firstResult.boundingBox())!.y).toBeLessThan(650);

    await page.goto(`/app/compare?ids=${pair.join(",")}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("first-comparison-facts")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await capture(page, info, "compare-390-dark");
  });
});
