import { expect, test } from "@playwright/test";

test("landing communicates value and method without hydration", async ({ page }) => {
  const response = await page.goto(
    "/dev/phase5a2/golden/landing?locale=en&theme=light&motion=reduced&state=ready",
  );
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Read the package");
  await expect(page.getByText("One answer, four accountable layers")).toBeVisible();
  await expect(page.getByText("Method before mystique")).toBeVisible();
  await expect(page.getByText("No account, camera, hosted database", { exact: false })).toBeVisible();
  await expect(page.getByText("Observed facts", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Derived interpretation", { exact: true }).first()).toBeVisible();
});
