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
  const primaryNavigation = page.getByRole("navigation", { name: "Primary navigation" });
  for (const name of ["Evidence", "Method", "Trust", "Contact"]) {
    await expect(primaryNavigation.getByRole("link", { name, exact: true })).toBeVisible();
  }
  const disclosure = page.locator('details[aria-label="Package source"]');
  await expect(disclosure).not.toHaveAttribute("open", "");
  const summary = disclosure.locator("summary");
  await summary.click();
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(disclosure.getByText("Decision and next action")).toBeVisible();
  await summary.click();
  await expect(disclosure).not.toHaveAttribute("open", "");
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.getByRole("button", { name: "Theme", exact: true })).toBeDisabled();
  const footer = page.locator("footer");
  await expect(footer.locator('a[href="#service-status"]')).toHaveText("Demo mode");
  await expect(footer.locator('a[href="/auth/login"]')).toHaveCount(0);
  await expect(
    page.locator("#evidence").getByRole("heading", {
      level: 3,
      name: "Decision and next action",
    }),
  ).toBeVisible();
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
