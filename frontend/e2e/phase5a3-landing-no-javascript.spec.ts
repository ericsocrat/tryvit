import { expect, test } from "./fixtures/safe-test";

test("retains complete server-rendered meaning without JavaScript", async ({ page }, testInfo) => {
  const dark = testInfo.project.name.endsWith("-dark");
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US" });
  await page.emulateMedia({ colorScheme: dark ? "dark" : "light", reducedMotion: "reduce" });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const html = await response!.text();
  expect(html).toContain("Read the package. See the reasoning. Make your own call.");
  expect(html).toContain("One answer, four accountable layers");
  expect(html).toContain("Method before mystique");
  expect(html).toContain("The website is available; live product data is paused");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("main button[aria-expanded]")).toBeDisabled();
  await expect(page.locator('header button[type="button"]')).toBeDisabled();
  await expect(page.getByText("Decision and next action").first()).toBeVisible();
  if (dark) {
    await expect(page.locator('[data-landing-shell="folded-label-register"]')).toHaveCSS(
      "color-scheme",
      "dark",
    );
  }
  await page.screenshot({
    path: testInfo.outputPath(
      dark
        ? "landing--390x844--no-javascript--dark--en.png"
        : "landing--390x844--no-javascript--light--en.png",
    ),
    animations: "disabled",
  });
});
