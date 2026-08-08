// ─── A11y audit: authenticated pages ────────────────────────────────────────
// Automated WCAG 2.1 AA compliance gate for auth-required routes.
// Requires explicit local-authenticated mode and a verified local emulator.
// Uses pre-authenticated storageState from auth.setup.ts.
//
// Critical + Serious violations → build failure (zero-tolerance).
// Moderate + Minor violations → console warnings.
//
// Issue #50 — A11y CI Gate
// Named authenticated-* to match the "authenticated" Playwright project pattern.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/safe-test";
import { assertNoA11yViolations, auditA11y } from "./helpers/a11y";

/* ── Auth-required routes to audit ───────────────────────────────────────── */

const fixtureProductId = process.env.QA_PRODUCT_ID;
if (!fixtureProductId || !/^[1-9][0-9]*$/u.test(fixtureProductId)) {
  throw new Error("[A11Y_FIXTURE] positive-product-id-required");
}

const PRODUCT_DETAIL_PATH = `/app/product/${fixtureProductId}`;

const AUTH_PAGES = [
  { name: "Search", path: "/app/search" },
  { name: "Settings", path: "/app/settings" },
  { name: "Categories", path: "/app/categories" },
  { name: "Lists", path: "/app/lists" },
  { name: "Dashboard", path: "/app" },
];

async function settleProductDetail(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function assertNoProductSemanticRegressions(page: Page) {
  const result = await new AxeBuilder({ page })
    .withRules(["aria-prohibited-attr", "label-content-name-mismatch"])
    .analyze();

  expect(result.violations).toEqual([]);
}

/* ── Per-page WCAG audits ────────────────────────────────────────────────── */

test.describe("A11y audit — authenticated pages", () => {
  for (const { name, path } of AUTH_PAGES) {
    test(`${name} (${path}) passes WCAG 2.1 AA audit`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("body")).toBeVisible();
      await assertNoA11yViolations(page);
    });
  }
});

test.describe("A11y audit — product-detail semantic regressions", () => {
  test("product detail has no Phase 5A.0e semantic blockers", async ({ page }) => {
    await page.goto(PRODUCT_DETAIL_PATH);
    await page.waitForLoadState("domcontentloaded");
    await settleProductDetail(page);
    await assertNoProductSemanticRegressions(page);
  });
});

/* ── Mobile viewport for authenticated pages ─────────────────────────────── */

test.describe("A11y audit — authenticated mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("search page passes a11y on mobile", async ({ page }) => {
    await page.goto("/app/search");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
    await assertNoA11yViolations(page);
  });

  test("dashboard passes a11y on mobile", async ({ page }) => {
    await page.goto("/app");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
    await assertNoA11yViolations(page);
  });

  test("product detail has no Phase 5A.0e semantic blockers on mobile", async ({ page }) => {
    await page.goto(PRODUCT_DETAIL_PATH);
    await page.waitForLoadState("domcontentloaded");
    await settleProductDetail(page);
    await assertNoProductSemanticRegressions(page);
  });
});

/* ── Dark mode for authenticated pages ───────────────────────────────────── */

test.describe("A11y audit — authenticated dark mode", () => {
  test("search page passes a11y in dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/app/search");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
    await assertNoA11yViolations(page);
  });
});

/* ── Baseline regression tracking ────────────────────────────────────────── */

test.describe("A11y audit — authenticated baseline", () => {
  test("search page zero blocking violations", async ({ page }) => {
    await page.goto("/app/search");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
    const result = await auditA11y(page);

    console.log(
      `A11y baseline (search) — blocking: ${result.blocking.length}, warnings: ${result.warnings.length}, passes: ${result.passes}`,
    );

    expect(result.blocking).toHaveLength(0);
  });
});
