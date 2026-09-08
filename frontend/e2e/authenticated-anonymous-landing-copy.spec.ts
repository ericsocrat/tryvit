import { expect, test } from "./fixtures/safe-test";
import { assertNoA11yViolations } from "./helpers/a11y";
import { loadSafetyContractFromEnvironment } from "./helpers/visual-safety";
import { getLandingCopy } from "../src/app/_landing-v2/copy";

// Share the guarded local build/project with the core journey. Each test uses
// Playwright's guarded fixture context with no authenticated storage state.
const safety = loadSafetyContractFromEnvironment(process.env);
if (safety.mode !== "local-authenticated") throw new Error("Landing-copy review requires the guarded local runtime");
test.use({ storageState: { cookies: [], origins: [] } });

for (const language of ["en", "pl", "de"] as const) {
  test.describe(`anonymous landing ${language}`, () => {
    // getServerLocale resolves Accept-Language; no invented locale cookies.
    test.use({ locale: language, extraHTTPHeaders: { "Accept-Language": language } });
    for (const width of [390, 1440]) {
      test(`${width}: current source-facts copy`, async ({ page, context }, info) => {
        const copy = getLandingCopy(language);
        expect(await context.cookies()).toEqual([]);
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
        await page.addInitScript(() => localStorage.setItem("theme", "light"));
        const response = await page.goto("/", { waitUntil: "domcontentloaded" });
        expect(response?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await expect(page).toHaveTitle(copy.metadata.title);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${copy.title} ${copy.titleAccent}`);
        await expect(page.getByText(copy.synthetic, { exact: true }).first()).toBeVisible();
        await expect(page.getByText(copy.preview.note, { exact: true })).toBeVisible();
        await expect(page.getByText(copy.derivedMeta, { exact: true })).toBeVisible();
        await expect(page.getByText(copy.contextMeta, { exact: true })).toBeVisible();
        await expect(page.getByText(copy.methodBody, { exact: true })).toBeVisible();
        await expect(page.locator("main")).not.toContainText(/72\s*\/\s*100|v0\.9|Moderate confidence|Umiarkowana wiarygodność|Mittlere Datenverlässlichkeit/);
        expect((await context.cookies()).some((cookie) => /sb-.*auth-token/.test(cookie.name))).toBe(false);
        await page.evaluate(() => document.fonts.ready);
        await page.locator("main").evaluate(async (main) => {
          await Promise.all(main.getAnimations({ subtree: true })
            .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
            .map((animation) => animation.finished.catch(() => undefined)));
        });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect((await assertNoA11yViolations(page)).blocking).toHaveLength(0);
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
        const screenshot = info.outputPath(`landing-current-${language}-${width}.png`);
        await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
        await info.attach(`landing-current-${language}-${width}`, { path: screenshot, contentType: "image/png" });
        const viewport = info.outputPath(`landing-current-${language}-${width}-viewport.png`);
        await page.screenshot({ path: viewport, animations: "disabled" });
        await info.attach(`landing-current-${language}-${width}-viewport`, { path: viewport, contentType: "image/png" });
      });
    }
  });
}
