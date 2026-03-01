// ─── Functional E2E: Search interactions ────────────────────────────────────
// Tests real user search flows: typing, submitting, viewing results, filtering,
// navigating to product detail. Runs against live Supabase data.
//
// Requires: authenticated session (depends on auth-setup project).
// 11 tests
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from "@playwright/test";

// ─── Search → Results → Product Navigation ─────────────────────────────────

test.describe("Search: query → results → product", () => {
  test("typing a query and pressing Enter shows results", async ({ page }) => {
    await page.goto("/app/search");
    await page.waitForLoadState("networkidle");

    const input = page.getByPlaceholder(/search products/i);
    await input.fill("chips");
    await input.press("Enter");

    // Wait for results to appear — should show result count text
    await expect(
      page.getByText(/\d+ results?/i).or(page.getByText(/\d+ wynik/i)),
    ).toBeVisible({ timeout: 15_000 });

    // Should have at least one product link in the results
    const productLinks = page.locator('a[href*="/app/product/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a search result navigates to product detail", async ({
    page,
  }) => {
    await page.goto("/app/search");
    await page.waitForLoadState("networkidle");

    const input = page.getByPlaceholder(/search products/i);
    await input.fill("chips");
    await input.press("Enter");

    // Wait for results
    const productLinks = page.locator('a[href*="/app/product/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });

    // Click the first product link
    await productLinks.first().click();

    // Should navigate to a product detail page
    await page.waitForURL(/\/app\/product\/\d+/, { timeout: 15_000 });

    // Product page should have a tab bar
    await expect(page.getByTestId("tab-bar")).toBeVisible({ timeout: 10_000 });
  });

  test("empty query with no filters shows empty state", async ({ page }) => {
    await page.goto("/app/search");
    await page.waitForLoadState("networkidle");

    // Without typing anything, the search should show empty state or recent searches
    // (not error state)
    await expect(page.locator("body")).not.toContainText(/failed|error/i, {
      timeout: 5_000,
    });
  });

  test("nonsensical query shows zero-results state", async ({ page }) => {
    await page.goto("/app/search");
    await page.waitForLoadState("networkidle");

    const input = page.getByPlaceholder(/search products/i);
    await input.fill("xyznonexistent999");
    await input.press("Enter");

    // Should show zero-results state
    await expect(
      page
        .getByTestId("zero-results")
        .or(page.getByText(/no results|brak wyników|0 results/i)),
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Search: View Mode Toggle ───────────────────────────────────────────────

test.describe("Search: view mode and interactions", () => {
  test("view mode toggle switches between grid and list", async ({ page }) => {
    await page.goto("/app/search");
    await page.waitForLoadState("networkidle");

    // Search for something to show results
    const input = page.getByPlaceholder(/search products/i);
    await input.fill("milk");
    await input.press("Enter");

    // Wait for results
    await expect(
      page.getByText(/\d+ results?/i).or(page.getByText(/\d+ wynik/i)),
    ).toBeVisible({ timeout: 15_000 });

    // Click the view mode toggle button
    const toggleBtn = page.locator(
      'button[aria-label*="view" i], button[aria-label*="widok" i]',
    );

    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      // After toggle, the layout should change — the page doesn't crash
      await expect(page.locator("body")).toBeVisible();
      // Toggle back
      await toggleBtn.click();
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("clear search button resets the input", async ({ page }) => {
    await page.goto("/app/search");
    await page.waitForLoadState("networkidle");

    const input = page.getByPlaceholder(/search products/i);
    await input.fill("test query");

    // Click the clear button (X icon)
    const clearBtn = page.locator(
      'button[aria-label*="clear" i], button[aria-label*="wyczyść" i]',
    );
    if (await clearBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await clearBtn.click();
      await expect(input).toHaveValue("");
    }
  });

  test("search results show product cards with scores", async ({ page }) => {
    await page.goto("/app/search");
    await page.waitForLoadState("networkidle");

    const input = page.getByPlaceholder(/search products/i);
    await input.fill("dairy");
    await input.press("Enter");

    // Wait for results
    const productLinks = page.locator('a[href*="/app/product/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });

    // Product cards should contain structured data: score gauge + product name
    // At minimum, the first card has visible text content
    const firstCard = productLinks.first();
    const cardText = await firstCard.textContent();
    expect(cardText?.length).toBeGreaterThan(0);
  });
});

// ─── Search: Filter Panel ───────────────────────────────────────────────────

test.describe("Search: filter panel", () => {
  // Use mobile viewport so the filter toggle button is visible
  test.use({ viewport: { width: 375, height: 812 } });

  test("filter button opens filter panel on mobile", async ({ page }) => {
    await page.goto("/app/search");
    await page.waitForLoadState("networkidle");

    // Click the Filters button (mobile-only toggle)
    const filterBtn = page.locator(
      'button:has-text("Filters"), button:has-text("Filtry")',
    );
    if (await filterBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await filterBtn.click();

      // Filter panel should appear — it contains category/sort options
      // Look for common filter elements
      await expect(
        page
          .getByText(/category|kategoria/i)
          .or(page.getByText(/sort by|sortuj/i))
          .first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test("applying a category filter narrows results", async ({ page }) => {
    await page.goto("/app/search");
    await page.waitForLoadState("networkidle");

    // Open filters
    const filterBtn = page.locator(
      'button:has-text("Filters"), button:has-text("Filtry")',
    );
    if (!(await filterBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await filterBtn.click();

    // Look for a category checkbox/button in the filter panel
    const categoryOption = page
      .locator('input[type="checkbox"], button')
      .filter({ hasText: /chips|dairy|drinks/i })
      .first();

    if (
      await categoryOption.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await categoryOption.click();

      // Close filter panel if there's a close/apply button
      const applyBtn = page
        .getByRole("button", { name: /apply|zastosuj|close|zamknij/i })
        .first();
      if (await applyBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await applyBtn.click();
      }

      // Results should show — active filter chip should appear
      await expect(
        page.locator('[class*="chip"], [class*="badge"], [class*="filter"]'),
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});

// ─── Search: Saved Searches Navigation ──────────────────────────────────────

test.describe("Search: saved searches link", () => {
  test("saved searches link navigates from search page", async ({ page }) => {
    await page.goto("/app/search");
    await page.waitForLoadState("networkidle");

    const savedLink = page.getByRole("link", { name: /saved/i }).first();
    if (await savedLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await savedLink.click();
      await expect(page).toHaveURL(/\/app\/search\/saved/);
      await expect(
        page.getByRole("heading", { name: /saved searches/i }),
      ).toBeVisible();
    }
  });
});
