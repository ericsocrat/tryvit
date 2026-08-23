import { expect, test } from "@playwright/test";

test("coarse pointer keeps search filters and scanner recovery touch-operable", async ({ page }) => {
  await page.goto("/dev/phase5a2/golden/search?locale=en&theme=light&motion=reduced&state=results");
  expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia("(hover: hover)").matches)).toBe(false);
  const filter = page.getByRole("button", { name: "Filters" });
  const box = await filter.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  if (!box) throw new Error("filter target missing");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(filter).toBeFocused();

  await page.goto("/dev/phase5a2/golden/scanner?locale=en&theme=dark&motion=reduced&state=permission-denied");
  await expect(page.getByRole("button", { name: "Enter barcode manually" })).toBeVisible();
  await expect(page.getByText("Manual entry remains available", { exact: false })).toBeVisible();
});
