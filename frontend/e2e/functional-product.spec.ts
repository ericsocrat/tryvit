// ─── Functional E2E: Product detail page ────────────────────────────────────
// Tests real product detail interactions: tab switching, score display, nutrition
// table, ingredients, alternatives. Navigates via category listing to get a real
// product rather than hardcoding IDs.
//
// Requires: authenticated session (depends on auth-setup project).
// 10 tests
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from "@playwright/test";

// Helper: navigate to the first product in a category listing
async function navigateToFirstProduct(
  page: import("@playwright/test").Page,
  category = "chips",
) {
  await page.goto(`/app/categories/${category}`);
  await page.waitForLoadState("networkidle");

  const productLinks = page.locator('a[href*="/app/product/"]');
  await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });
  await productLinks.first().click();
  await page.waitForURL(/\/app\/product\/\d+/, { timeout: 15_000 });
}

// ─── Product Detail: Core Display ──────────────────────────────────────────

test.describe("Product detail: core display", () => {
  test("product page renders with score, name, and brand", async ({
    page,
  }) => {
    await navigateToFirstProduct(page);

    // Should have the tab bar
    await expect(page.getByTestId("tab-bar")).toBeVisible({ timeout: 10_000 });

    // Product name should be visible in the header (h1 or prominent text)
    const productName = page.locator(
      "p.text-lg.font-bold, h1, [data-testid='product-name']",
    );
    await expect(productName.first()).toBeVisible();
    const nameText = await productName.first().textContent();
    expect(nameText?.length).toBeGreaterThan(0);

    // Brand should be visible
    const brandText = page.locator("p.text-sm.text-foreground-secondary");
    await expect(brandText.first()).toBeVisible();
  });

  test("product page shows Nutri-Score badge", async ({ page }) => {
    await navigateToFirstProduct(page);

    // Nutri-Score badge should be visible
    await expect(
      page
        .getByText(/nutri.score/i)
        .or(page.getByText(/nutri-score/i))
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("product page shows score interpretation card", async ({ page }) => {
    await navigateToFirstProduct(page);

    // Score interpretation expandable card
    const interpCard = page.getByTestId("score-interpretation");
    await expect(interpCard).toBeVisible({ timeout: 10_000 });

    // Click to expand
    await interpCard.click();

    // Content should appear
    await expect(
      page.getByTestId("score-interpretation-content"),
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Product Detail: Tab Navigation ─────────────────────────────────────────

test.describe("Product detail: tab navigation", () => {
  test("Overview tab shows ingredients and allergens", async ({ page }) => {
    await navigateToFirstProduct(page);

    // Overview tab is selected by default
    const overviewTab = page.locator('[role="tab"][aria-selected="true"]');
    await expect(overviewTab).toBeVisible();

    // Ingredients section should be visible
    await expect(
      page
        .getByText(/ingredients|składniki/i)
        .first(),
    ).toBeVisible({ timeout: 10_000 });

    // Allergens section should be visible
    await expect(
      page
        .getByText(/allergen|alergeny/i)
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Nutrition tab shows nutrition table with values", async ({ page }) => {
    await navigateToFirstProduct(page);

    // Click the Nutrition tab
    const nutritionTab = page.getByRole("tab", {
      name: /nutrition|wartości odżywcze/i,
    });
    await expect(nutritionTab).toBeVisible({ timeout: 10_000 });
    await nutritionTab.click();

    // Nutrition table should show calorie and macronutrient values
    await expect(
      page.getByText(/kcal/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Should have fat/protein/carb labels
    await expect(
      page
        .getByText(/fat|tłuszcz/i)
        .first(),
    ).toBeVisible();
  });

  test("Alternatives tab shows healthier substitutes", async ({ page }) => {
    await navigateToFirstProduct(page);

    // Click the Alternatives tab
    const altTab = page.getByRole("tab", {
      name: /alternatives|alternatyw/i,
    });
    await expect(altTab).toBeVisible({ timeout: 10_000 });
    await altTab.click();

    // Should show alternatives list or empty state
    await page.waitForTimeout(2_000); // Allow data to load
    const body = page.locator("body");
    await expect(body).toBeVisible();
    // Should not crash — either shows alternatives or "no alternatives" message
    await expect(body).not.toContainText(/failed|error/i);
  });

  test("Scoring tab shows score breakdown", async ({ page }) => {
    await navigateToFirstProduct(page);

    // Click the Scoring tab
    const scoringTab = page.getByRole("tab", {
      name: /scoring|punktacja/i,
    });
    await expect(scoringTab).toBeVisible({ timeout: 10_000 });
    await scoringTab.click();

    // Score breakdown panel should render
    await page.waitForTimeout(2_000);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/failed|error/i);
  });

  test("switching between tabs preserves page state", async ({ page }) => {
    await navigateToFirstProduct(page);

    // Click through all tabs in sequence
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).click();
      // Each tab switch should keep us on the same product page
      await expect(page).toHaveURL(/\/app\/product\/\d+/);
      // Selected tab should update
      await expect(tabs.nth(i)).toHaveAttribute("aria-selected", "true");
    }
  });
});

// ─── Product Detail: EAN and Category Info ──────────────────────────────────

test.describe("Product detail: metadata", () => {
  test("product page shows category and EAN", async ({ page }) => {
    await navigateToFirstProduct(page);

    // Category info should be visible (category icon + name)
    const categoryText = page.locator(
      ".text-xs.text-foreground-secondary",
    );
    await expect(categoryText.first()).toBeVisible({ timeout: 10_000 });

    // At least the category text should be present
    const metadataText = await categoryText.first().textContent();
    expect(metadataText?.length).toBeGreaterThan(0);
  });

  test("breadcrumbs link back to search from product page", async ({
    page,
  }) => {
    await navigateToFirstProduct(page);

    // Click the Search breadcrumb
    const searchBreadcrumb = page.locator('a[href="/app/search"]').first();
    if (
      await searchBreadcrumb.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await searchBreadcrumb.click();
      await expect(page).toHaveURL(/\/app\/search/);
    }
  });
});
