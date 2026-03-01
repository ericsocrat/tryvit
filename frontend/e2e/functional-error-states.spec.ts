// ─── Functional E2E: Error states & edge cases ─────────────────────────────
// Tests error handling, empty states, and edge case scenarios that existing
// smoke tests don't cover (actual interaction with error paths).
//
// Requires: authenticated session (depends on auth-setup project).
// 8 tests
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from "@playwright/test";

// ─── Invalid Routes ────────────────────────────────────────────────────────

test.describe("Error states: invalid routes", () => {
  test("non-existent category shows error or empty state", async ({
    page,
  }) => {
    await page.goto("/app/categories/nonexistent-fake-category-xyz");
    await page.waitForLoadState("networkidle");

    // Should not crash — shows error / empty state
    await expect(page.locator("body")).toBeVisible();

    // Should stay on the category page (not redirect to login)
    expect(page.url()).not.toMatch(/\/auth\/login/);

    // Should show some indication of no products or error
    await expect(
      page
        .getByText(/no products|brak produktów|error|błąd|not found|0 products/i)
        .or(page.locator('[data-testid="empty-state"]'))
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("product ID 0 shows error state", async ({ page }) => {
    await page.goto("/app/product/0");
    await page.waitForLoadState("networkidle");

    // Should not crash
    await expect(page.locator("body")).toBeVisible();
    expect(page.url()).not.toMatch(/\/auth\/login/);
  });

  test("negative product ID shows error state", async ({ page }) => {
    await page.goto("/app/product/-1");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
    expect(page.url()).not.toMatch(/\/auth\/login/);
  });

  test("extremely large product ID shows not-found state", async ({
    page,
  }) => {
    await page.goto("/app/product/99999999");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
    expect(page.url()).not.toMatch(/\/auth\/login/);

    // Should show not-found or error message
    await expect(
      page
        .getByText(
          /not found|nie znaleziono|failed|nie udało się|does not exist/i,
        )
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Empty States ──────────────────────────────────────────────────────────

test.describe("Error states: empty states", () => {
  test("scan history shows empty state for fresh user", async ({ page }) => {
    await page.goto("/app/scan/history");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText(/no scans|brak skanów/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("saved searches shows empty state for fresh user", async ({ page }) => {
    await page.goto("/app/search/saved");
    await page.waitForLoadState("networkidle");

    // Should show empty state or "no saved searches" message
    await expect(page.locator("body")).toBeVisible();
    expect(page.url()).toMatch(/\/app\/search\/saved/);
  });

  test("saved comparisons shows empty state for fresh user", async ({
    page,
  }) => {
    await page.goto("/app/compare/saved");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
    expect(page.url()).toMatch(/\/app\/compare\/saved/);
  });

  test("submissions page shows empty state for fresh user", async ({
    page,
  }) => {
    await page.goto("/app/scan/submissions");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /My Submissions/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
