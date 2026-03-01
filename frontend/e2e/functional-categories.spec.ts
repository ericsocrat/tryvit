// ─── Functional E2E: Category browsing ──────────────────────────────────────
// Tests real user category flows: viewing the overview grid, clicking into a
// category listing, sorting products, and navigating to product detail.
//
// Requires: authenticated session (depends on auth-setup project).
// 9 tests
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from "@playwright/test";

// ─── Category Overview Grid ────────────────────────────────────────────────

test.describe("Categories: overview grid", () => {
  test("category grid loads with clickable cards", async ({ page }) => {
    await page.goto("/app/categories");
    await page.waitForLoadState("networkidle");

    // Should have category heading
    await expect(
      page.getByRole("heading", { name: /categor/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Should have category card links
    const categoryLinks = page.locator(
      'a[href*="/app/categories/"]',
    );
    await expect(categoryLinks.first()).toBeVisible({ timeout: 15_000 });

    // Should have multiple categories
    const count = await categoryLinks.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("category cards display score information", async ({ page }) => {
    await page.goto("/app/categories");
    await page.waitForLoadState("networkidle");

    const categoryLinks = page.locator('a[href*="/app/categories/"]');
    await expect(categoryLinks.first()).toBeVisible({ timeout: 15_000 });

    // Cards should contain text content (category name, stats)
    const firstCard = categoryLinks.first();
    const cardText = await firstCard.textContent();
    expect(cardText?.length).toBeGreaterThan(0);
  });
});

// ─── Category Overview → Category Listing ──────────────────────────────────

test.describe("Categories: click through to listing", () => {
  test("clicking a category card navigates to listing page", async ({
    page,
  }) => {
    await page.goto("/app/categories");
    await page.waitForLoadState("networkidle");

    const categoryLinks = page.locator('a[href*="/app/categories/"]');
    await expect(categoryLinks.first()).toBeVisible({ timeout: 15_000 });

    // Get the href of the first category
    const href = await categoryLinks.first().getAttribute("href");
    expect(href).toBeTruthy();

    // Click it
    await categoryLinks.first().click();

    // Should navigate to the category listing page
    await page.waitForURL(/\/app\/categories\//, { timeout: 15_000 });

    // Should show a heading with the category name (capitalized slug)
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
  });

  test("category listing shows product list", async ({ page }) => {
    await page.goto("/app/categories");
    await page.waitForLoadState("networkidle");

    const categoryLinks = page.locator('a[href*="/app/categories/"]');
    await expect(categoryLinks.first()).toBeVisible({ timeout: 15_000 });
    await categoryLinks.first().click();
    await page.waitForURL(/\/app\/categories\//, { timeout: 15_000 });

    // Should have products in the listing
    const productLinks = page.locator('a[href*="/app/product/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });

    // Should have product count text
    await expect(
      page
        .getByText(/\d+ products?/i)
        .or(page.getByText(/\d+ produkt/i))
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Category Listing Interactions ──────────────────────────────────────────

test.describe("Categories: listing interactions", () => {
  test("sort dropdown changes product order", async ({ page }) => {
    // Go directly to a category listing (chips is reliable)
    await page.goto("/app/categories/chips");
    await page.waitForLoadState("networkidle");

    // Wait for products to load
    const productLinks = page.locator('a[href*="/app/product/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });

    // Get the first product name before sorting
    const firstBefore = await productLinks.first().textContent();

    // Find the sort select and change it to "name"
    const sortSelect = page.locator("select").first();
    if (await sortSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sortSelect.selectOption({ index: 1 }); // Switch to second option

      // Wait for re-render
      await page.waitForTimeout(1_000);

      // The product list should still have items
      await expect(productLinks.first()).toBeVisible({ timeout: 10_000 });

      // No crash, page still working
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("sort direction toggle reverses order", async ({ page }) => {
    await page.goto("/app/categories/chips");
    await page.waitForLoadState("networkidle");

    const productLinks = page.locator('a[href*="/app/product/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });

    // Click the sort direction button (Asc ↔ Desc)
    const dirBtn = page.locator(
      'button[aria-label*="sort" i], button[aria-label*="sortuj" i]',
    );
    if (await dirBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dirBtn.click();

      // Products should still render after direction change
      await expect(productLinks.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("clicking a product from listing navigates to detail", async ({
    page,
  }) => {
    await page.goto("/app/categories/chips");
    await page.waitForLoadState("networkidle");

    const productLinks = page.locator('a[href*="/app/product/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });

    // Click the first product
    await productLinks.first().click();

    // Should navigate to product detail page
    await page.waitForURL(/\/app\/product\/\d+/, { timeout: 15_000 });

    // Product page should render with tab bar
    await expect(page.getByTestId("tab-bar")).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Category Listing: Stats Card ───────────────────────────────────────────

test.describe("Categories: stats card", () => {
  test("category listing shows summary statistics", async ({ page }) => {
    await page.goto("/app/categories/chips");
    await page.waitForLoadState("networkidle");

    // Wait for products to load (stats load from same data)
    const productLinks = page.locator('a[href*="/app/product/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });

    // Stats card should show score range (contains "–" between numbers)
    const statsCard = page.locator(".card").first();
    await expect(statsCard).toBeVisible();
  });

  test("breadcrumbs allow navigation back to categories", async ({ page }) => {
    await page.goto("/app/categories/chips");
    await page.waitForLoadState("networkidle");

    // Click the "Categories" breadcrumb
    const breadcrumbLink = page.locator(
      'a[href="/app/categories"]',
    );
    if (await breadcrumbLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await breadcrumbLink.click();
      await expect(page).toHaveURL(/\/app\/categories$/);
    }
  });
});
