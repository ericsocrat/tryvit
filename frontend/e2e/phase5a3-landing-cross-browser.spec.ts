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
