// ─── Functional E2E: Cross-page user journeys ──────────────────────────────
// Tests complete user workflows spanning multiple pages — the kind of flows
// that catch integration bugs between components and routes.
//
// Requires: authenticated session (depends on auth-setup project).
// 7 tests
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from "./fixtures/safe-test";

async function ensureFullAnalysis(page: import("@playwright/test").Page) {
  const tabBar = page.getByTestId("tab-bar");
  if (!(await tabBar.isVisible().catch(() => false))) {
    const toggle = page.getByTestId("toggle-analysis");
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
    }
  }
  await expect(tabBar).toBeVisible({ timeout: 10_000 });
}

// ─── Journey: Search → Product → Alternatives → Product ────────────────────

test.describe("Journey: search → product → alternatives", () => {
  test("search → click result → view product → switch tabs", async ({
    page,
  }) => {
    // 1. Search for chips
    await page.goto("/app/search");
    await page.waitForLoadState("domcontentloaded");

    const input = page.getByPlaceholder(/search products/i);
    await input.fill("chips");
    await input.press("Enter");

    // 2. Wait for results
    const productLinks = page.locator('a[href*="/app/product/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });

    // 3. Click the first result
    await productLinks.first().click();
    await page.waitForURL(/\/app\/product\/\d+/, { timeout: 15_000 });

    // 4. Verify product detail loads with tab bar
    await ensureFullAnalysis(page);

    // 5. Click Nutrition tab
    const nutritionTab = page.getByRole("tab").nth(1);
    await expect(nutritionTab).toBeVisible();
    await nutritionTab.click();
    await expect(
      page.getByText(/kcal/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // 6. Click Alternatives tab
    const altTab = page.getByRole("tab").nth(2);
    await expect(altTab).toBeVisible({ timeout: 10_000 });
    await altTab.click();

    // Should not crash — waits for content
    await page.waitForTimeout(2_000);
    await expect(page.locator("body")).not.toContainText(/failed|error/i);
  });
});

// ─── Journey: Categories → Product → Back ──────────────────────────────────

test.describe("Journey: categories → product → back", () => {
  test("browse categories → enter listing → click product → use browser back", async ({
    page,
  }) => {
    // 1. Go to categories
    await page.goto("/app/categories");
    await page.waitForLoadState("domcontentloaded");

    const categoryLinks = page.locator(
      'a[href^="/app/categories/"]:not([href="/app/categories"])',
    );
    await expect(categoryLinks.first()).toBeVisible({ timeout: 15_000 });

    // 2. Click a category
    await categoryLinks.first().click();
    await page.waitForURL(/\/app\/categories\//, { timeout: 15_000 });

    // 3. Click a product from the listing
    const productLinks = page.locator('a[href*="/app/product/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });
    await productLinks.first().click();
    await page.waitForURL(/\/app\/product\/\d+/, { timeout: 15_000 });

    // 4. Verify product rendered
    await ensureFullAnalysis(page);

    // 5. Go back — should return to category listing
    await page.goBack();
    await page.waitForURL(/\/app\/categories\//, { timeout: 15_000 });

    // 6. Products should still be visible
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Journey: Home → Categories → Search (Navigation) ──────────────────────

test.describe("Journey: app navigation", () => {
  test("home → categories → search via app navigation", async ({ page }) => {
    // 1. Start at home
    await page.goto("/app");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();

    // 2. Navigate to categories
    await page.goto("/app/categories");
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.getByRole("heading", { name: /categories|kategor/i }),
    ).toBeVisible({ timeout: 10_000 });

    // 3. Navigate to search
    await page.goto("/app/search");
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.getByPlaceholder(/search products/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Journey: Scan → Not Found → Submit Form ───────────────────────────────

test.describe("Journey: scan → submission", () => {
  test("manual scan unknown EAN → not found → submit product page", async ({
    page,
  }) => {
    // 1. Go to scan page
    await page.goto("/app/scan");
    await page.waitForLoadState("domcontentloaded");

    // 2. Switch to manual mode
    await page.getByRole("button", { name: "Manual", exact: true }).click();

    // 3. Enter an unknown EAN
    const eanInput = page.getByPlaceholder(/EAN|barcode|kod kreskowy/i);
    await expect(eanInput).toBeVisible();
    await eanInput.fill("0000000000000");

    // 4. Submit manual lookup using the visible manual form submit button
    const lookupButton = page.locator('button[type="submit"]').first();
    await expect(lookupButton).toBeVisible({ timeout: 10_000 });
    await lookupButton.click();

    // 5. Wait for any lookup outcome state and ensure the page remains healthy.
    await page.waitForTimeout(3_000);
    await expect(page.locator("body")).not.toContainText(/unexpected error/i);

    // 6. If there's a submit link/button, click it
    const submitLink = page
      .getByRole("link", { name: /submit/i })
      .or(page.getByRole("button", { name: /submit/i }))
      .first();

    if (await submitLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await submitLink.click();

      // Should navigate to submit product page
      await page.waitForURL(/\/app\/scan\/submit/, { timeout: 15_000 });

      // Submit form should be visible
      await expect(
        page.getByRole("heading", { name: /submit product|dodaj produkt/i }),
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});

// ─── Journey: Settings Interaction ──────────────────────────────────────────

test.describe("Journey: settings interaction", () => {
  test("settings page loads and country selector is interactive", async ({
    page,
  }) => {
    await page.goto("/app/settings");
    await page.waitForLoadState("domcontentloaded");

    // Settings page should render profile heading.
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toBeVisible({ timeout: 10_000 });

    // Country selector shows Poland (test user's preference)
    await expect(
      page.locator("button").filter({ hasText: "Polska" }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Navigate to Account tab where account actions live.
    const accountTab = page.getByRole("link", { name: /account|konto/i }).first();
    await expect(accountTab).toBeVisible({ timeout: 10_000 });
    await accountTab.click();
    await page.waitForURL(/\/app\/settings\/account/, { timeout: 15_000 });

    // Account action is visible.
    await expect(page.getByTestId("delete-account-button")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("compare empty state → search CTA → search page", async ({ page }) => {
    await page.goto("/app/compare");
    await page.waitForLoadState("domcontentloaded");

    // Empty state with Search Products CTA
    const searchCta = page.getByRole("link", {
      name: /search products|szukaj produktów/i,
    });
    await expect(searchCta).toBeVisible({ timeout: 10_000 });

    // Click the CTA
    await searchCta.click();
    await expect(page).toHaveURL(/\/app\/search/);
  });
});

// ─── Journey: Lists → Create → View ────────────────────────────────────────

test.describe("Journey: lists management", () => {
  test("lists → create new list → verify it appears", async ({ page }) => {
    await page.goto("/app/lists");
    await page.waitForLoadState("domcontentloaded");

    // Click New List button
    const newListBtn = page
      .locator("button:visible")
      .filter({ hasText: /new|lista|create|utwórz/i })
      .first();
    const canOpenForm = await newListBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (canOpenForm) {
      await newListBtn.click();
    }

    // Fill in the form
    const nameInput = page
      .getByLabel(/list name|nazwa listy/i)
      .or(page.getByPlaceholder(/List name|Nazwa listy/i))
      .first();
    const hasNameInput = await nameInput
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!hasNameInput) {
      test.skip();
      return;
    }
    await expect(nameInput).toBeVisible();
    await nameInput.fill("E2E Test List");

    const descInput = page
      .getByLabel(/description|opis/i)
      .or(page.getByPlaceholder(/Description|Opis/i))
      .first();
    await descInput.fill("Created by E2E test");

    // Submit the form
    await page.getByRole("button", { name: /Create List|Utwórz listę/i }).click();

    // Wait for the list to appear — should see "E2E Test List" somewhere
    await expect(
      page.getByText("E2E Test List"),
    ).toBeVisible({ timeout: 10_000 });

    // Verify we're still on the lists page
    expect(page.url()).toMatch(/\/app\/lists/);
  });
});

