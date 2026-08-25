import { expect, test } from "./fixtures/safe-test";

for (const reducedMotion of [false, true]) {
  test(`keeps mobile navigation and disclosure native with reduced motion ${reducedMotion}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US" });
    await page.emulateMedia({
      colorScheme: "light",
      reducedMotion: reducedMotion ? "reduce" : "no-preference",
    });

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    const primary = page.getByRole("navigation", { name: "Primary navigation" });
    for (const name of ["Evidence", "Method", "Trust", "Contact"]) {
      await expect(primary.getByRole("link", { name, exact: true })).toBeVisible();
    }

    const disclosure = page.locator('details[aria-label="Package source"]');
    const summary = disclosure.locator("summary");
    await expect(disclosure).not.toHaveAttribute("open", "");
    await expect(summary.getByText("Unfold the evidence", { exact: true })).toBeVisible();
    await summary.click();
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(summary.getByText("Fold back to source", { exact: true })).toBeVisible();
    await summary.click();
    await expect(disclosure).not.toHaveAttribute("open", "");

    await page.reload();
    await expect(disclosure).not.toHaveAttribute("open", "");
    let reachedSummary = false;
    const focusSequence: string[] = [];
    for (let index = 0; index < 16; index += 1) {
      await page.keyboard.press("Tab");
      reachedSummary = await summary.evaluate((element) => element === document.activeElement);
      focusSequence.push(
        await page.evaluate(() =>
          `${document.activeElement?.tagName ?? "NONE"}:${document.activeElement?.textContent?.trim() ?? ""}`,
        ),
      );
      if (reachedSummary) break;
    }
    expect(reachedSummary, focusSequence.join(" -> ")).toBe(true);
    await expect(summary).toBeFocused();
    expect(await summary.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(summary.getByText("Fold back to source", { exact: true })).toBeVisible();
    await page.keyboard.press("Space");
    await expect(disclosure).not.toHaveAttribute("open", "");
    await expect(summary.getByText("Unfold the evidence", { exact: true })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });
}

test("keeps tablet anchor destinations clear of the sticky header", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US" });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  for (const [href, target] of [
    ["#evidence", "#evidence"],
    ["#method", "#method"],
    ["#trust", "#trust"],
    ["#service-status", "#service-status"],
  ] as const) {
    await page.locator(`header a[href="${href}"]`).click();
    const geometry = await page.locator(target).evaluate((element) => {
      const targetRect = element.getBoundingClientRect();
      const headerRect = document.querySelector("header")!.getBoundingClientRect();
      return { targetTop: targetRect.top, headerBottom: headerRect.bottom };
    });
    expect(geometry.targetTop + 1).toBeGreaterThanOrEqual(geometry.headerBottom);
  }
});
