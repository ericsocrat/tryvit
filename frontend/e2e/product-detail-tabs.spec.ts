// ─── Product Detail Tabs — No Duplication (Issue #122) ──────────────────────
// Verifies that shared sections (score explanation, health warnings, tab bar)
// render exactly ONCE regardless of which tab is active.
//
// Requires an authenticated user with a product available in the database.
// Falls back to smoke-level checks if no product is reachable.

import { expect, test } from "./fixtures/safe-test";

// ── Test IDs referenced in acceptance criteria ──────────────────────────────

const SCORE_INTERPRETATION = '[data-testid="score-interpretation"]';
const HEALTH_WARNINGS = '[data-testid="health-warnings-card"]';
const TAB_BAR = '[data-testid="tab-bar"]';

const fixtureProductId = process.env.QA_PRODUCT_ID;
if (!fixtureProductId || !/^[1-9][0-9]*$/u.test(fixtureProductId)) {
  throw new Error("[PRODUCT_TABS_FIXTURE] positive-product-id-required");
}
const PRODUCT_DETAIL_PATH = `/app/product/${fixtureProductId}`;
const TAB_IDS = ["overview", "nutrition", "alternatives", "scoring"] as const;

async function openFullAnalysis(page: import("@playwright/test").Page) {
  await page.goto(PRODUCT_DETAIL_PATH, { waitUntil: "domcontentloaded" });
  const tabBar = page.locator(TAB_BAR);
  if (!(await tabBar.isVisible().catch(() => false))) {
    const toggle = page.getByTestId("toggle-analysis");
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    await toggle.click();
  }
  await expect(tabBar).toBeVisible({ timeout: 15_000 });
}

// ── Desktop viewport (1280px) ───────────────────────────────────────────────

test.describe("Product detail — no section duplication (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("shared sections render exactly once on every tab", async ({
    page,
  }) => {
    await openFullAnalysis(page);

    // Verify single instance on default (Overview) tab
    await expect(page.locator(SCORE_INTERPRETATION)).toHaveCount(1);
    await expect(page.locator(HEALTH_WARNINGS)).toHaveCount(1);
    await expect(page.locator(TAB_BAR)).toHaveCount(1);
    await expect(page.getByRole("tablist")).toHaveCount(1);

    // Switch through all tabs and re-assert
    for (const tabId of TAB_IDS) {
      await page.locator(`#tab-${tabId}`).click();

      // Wait for any transition to settle
      await page.waitForTimeout(300);

      await expect(page.locator(SCORE_INTERPRETATION)).toHaveCount(1);
      await expect(page.locator(HEALTH_WARNINGS)).toHaveCount(1);
      await expect(page.locator(TAB_BAR)).toHaveCount(1);
      await expect(page.getByRole("tablist")).toHaveCount(1);
    }
  });

  test("score interpretation is in left column, not tab content", async ({
    page,
  }) => {
    await openFullAnalysis(page);

    // Score interpretation should be a sibling of (or within) the left column,
    // NOT inside the right column that holds tabs
    const leftCol = page.locator(String.raw`.lg\:col-span-5`);
    const rightCol = page.locator(String.raw`.lg\:col-span-7`);

    await expect(
      leftCol.locator('[data-testid="score-interpretation"]'),
    ).toHaveCount(1);
    await expect(
      rightCol.locator('[data-testid="score-interpretation"]'),
    ).toHaveCount(0);
  });
});

// ── Mobile viewport (375px) — Issue #122 was first observed on mobile ───────

test.describe("Product detail — no section duplication (mobile 375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("shared sections render exactly once on every tab (mobile)", async ({
    page,
  }) => {
    await openFullAnalysis(page);

    for (const tabId of TAB_IDS) {
      await page.locator(`#tab-${tabId}`).click();
      await page.waitForTimeout(300);

      await expect(page.locator(SCORE_INTERPRETATION)).toHaveCount(1);
      await expect(page.locator(HEALTH_WARNINGS)).toHaveCount(1);
      await expect(page.locator(TAB_BAR)).toHaveCount(1);
    }
  });
});
