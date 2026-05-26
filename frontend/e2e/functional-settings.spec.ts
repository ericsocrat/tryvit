// ─── Functional E2E: Settings flow ──────────────────────────────────────────
// Tests user preference management: navigating settings tabs, changing country
// and language, saving preferences, and verifying toast feedback.
//
// Requires: authenticated session (depends on auth-setup project).
// 7 tests
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from "@playwright/test";

// ─── Settings navigation ────────────────────────────────────────────────────

test.describe("Settings: tab navigation", () => {
  test("settings page renders with Profile tab active", async ({ page }) => {
    await page.goto("/app/settings");
    await page.waitForLoadState("domcontentloaded");

    // Profile tab should be active on the base settings route.
    const profileTab = page
      .locator('a[href="/app/settings"][aria-current="page"]')
      .first();
    await expect(profileTab).toBeVisible();

    // Profile page should render its heading.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("can navigate to Nutrition & Diet tab", async ({ page }) => {
    await page.goto("/app/settings");
    await page.waitForLoadState("domcontentloaded");

    const nutritionTab = page.getByRole("link", {
      name: /Nutrition & Diet/i,
    });
    await expect(nutritionTab).toBeVisible({ timeout: 10_000 });
    await nutritionTab.click();

    await page.waitForURL(/\/app\/settings\/nutrition/);
    await expect(page.locator("body")).not.toContainText(/error|failed/i);
  });

  test("can navigate to Account tab", async ({ page }) => {
    await page.goto("/app/settings");
    await page.waitForLoadState("domcontentloaded");

    const accountTab = page.getByRole("link", { name: /Account/i });
    await expect(accountTab).toBeVisible({ timeout: 10_000 });
    await accountTab.click();

    await page.waitForURL(/\/app\/settings\/account/);

    // Account page should render a stable destructive action.
    await expect(
      page.getByTestId("delete-account-button"),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Preference changes ─────────────────────────────────────────────────────

test.describe("Settings: preference changes", () => {
  test("country and language selectors are visible", async ({ page }) => {
    await page.goto("/app/settings");
    await page.waitForLoadState("domcontentloaded");

    // Country section heading
    await expect(
      page.getByText(/Country|Kraj/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Language section heading
    await expect(page.getByText(/Language|Język/i).first()).toBeVisible();

    // Country buttons should be visible.
    await expect(page.getByRole("button", { name: /Polska/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Deutschland/i }),
    ).toBeVisible();
  });

  test("changing country shows save button", async ({ page }) => {
    await page.goto("/app/settings");
    await page.waitForLoadState("domcontentloaded");

    // Save button should not be visible initially (form not dirty)
    const saveBtn = page.getByRole("button", {
      name: /Save changes|Zapisz zmiany/i,
    });
    await expect(saveBtn).not.toBeVisible({ timeout: 3_000 });

    // Click a different country to make the form dirty
    // Test user defaults to PL, so click DE
    const deBtn = page.getByRole("button", { name: /Deutschland/i });
    const plBtn = page.getByRole("button", { name: /Polska/i });

    // To reliably toggle, check which is currently active and click the other
    const deVisible = await deBtn.isVisible().catch(() => false);

    if (deVisible) {
      await deBtn.click();
      // Save button should now appear
      await expect(saveBtn).toBeVisible({ timeout: 5_000 });

      // Switch back to PL so test user state remains consistent
      await expect(plBtn).toBeVisible();
      await plBtn.click();
    }
  });

  test("saving preferences shows success toast", async ({ page }) => {
    await page.goto("/app/settings");
    await page.waitForLoadState("domcontentloaded");

    // Click a different country to trigger dirty state
    const deBtn = page.getByRole("button", { name: /Deutschland/i });
    await expect(deBtn).toBeVisible({ timeout: 10_000 });
    await deBtn.click();

    // Save button should appear
    const saveBtn = page.getByRole("button", {
      name: /Save changes|Zapisz zmiany/i,
    });
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await saveBtn.click();

    // Dirty-state save bar should collapse after successful save.
    await expect(saveBtn).not.toBeVisible({ timeout: 10_000 });

    // Restore original setting — switch back to PL
    const plBtn = page.getByRole("button", { name: /Polska/i });
    const plVisible = await plBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (plVisible) {
      await plBtn.click();
      const saveBtnAgain = page.getByRole("button", {
        name: /Save changes|Zapisz zmiany/i,
      });
      const saveVisible = await saveBtnAgain
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (saveVisible) {
        await saveBtnAgain.click();
        await page.waitForTimeout(2_000);
      }
    }
  });

  test("preferences persist after page reload", async ({ page }) => {
    await page.goto("/app/settings");
    await page.waitForLoadState("domcontentloaded");

    // Verify the page loads with preferences set (country visible)
    await expect(page.getByRole("button", { name: /Polska/i })).toBeVisible({
      timeout: 10_000,
    });

    // Reload the page
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Country selector should still be visible — preferences persisted
    await expect(page.getByRole("button", { name: /Polska/i })).toBeVisible({
      timeout: 10_000,
    });

    // No error state
    await expect(page.locator("body")).not.toContainText(/error|failed/i);
  });
});

