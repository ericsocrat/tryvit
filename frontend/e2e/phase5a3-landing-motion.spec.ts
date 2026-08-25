import { expect, test } from "./fixtures/safe-test";

for (const motion of ["normal", "reduced"] as const) {
  test(`records the complete ${motion} landing journey`, async ({ page }, testInfo) => {
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US" });
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.emulateMedia({
      colorScheme: "light",
      reducedMotion: motion === "reduced" ? "reduce" : "no-preference",
    });
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await page.evaluate(() => document.fonts.ready);
    const video = page.video();
    expect(video).not.toBeNull();

    const narrative = page.locator('main button[aria-expanded]');
    await expect(narrative).toHaveAttribute("aria-expanded", "false");
    await narrative.focus();
    await narrative.click();
    await expect(narrative).toHaveAttribute("aria-expanded", "true");
    await page.waitForTimeout(motion === "reduced" ? 80 : 650);

    for (const selector of ["#evidence", "#method", "#trust", "#landing-final-title"]) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(motion === "reduced" ? 80 : 420);
    }

    const theme = page.getByRole("button", { name: "Use dark theme" });
    await theme.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.waitForTimeout(motion === "reduced" ? 80 : 220);

    await page.close();
    await video!.saveAs(testInfo.outputPath(`landing--${motion}--390x844--en.webm`));
  });
}
