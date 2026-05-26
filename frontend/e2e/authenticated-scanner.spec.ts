// ─── E2E: Scanner EAN lookup integration tests ──────────────────────────────
// These tests exercise the REAL scan flow against the live Supabase backend.
// They would have caught the nutri_score column mismatch bug before production.
//
// Requires: authenticated session (depends on auth-setup project).
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from "@playwright/test";

async function disableNextDevOverlay(page: import("@playwright/test").Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

async function lookupProductByEan(
  page: import("@playwright/test").Page,
  ean: string,
) {
  await page.goto("/app/scan");
  await disableNextDevOverlay(page);
  await page.getByRole("button", { name: /Manual/i }).click();
  const eanInput = page.getByPlaceholder(/Enter barcode/i);
  await expect(eanInput).toBeVisible();
  await eanInput.fill(ean);
  await page.getByRole("button", { name: /Look up/i }).click();
}

// Known EANs that exist in the database
const KNOWN_EANS = [
  { ean: "5900320001303", description: "a known Polish product" },
  { ean: "9062300130833", description: "a known EU product" },
  { ean: "4003301069048", description: "a known German product" },
];

const UNKNOWN_EAN = "0000000000000";

// ─── Manual EAN Lookup ─────────────────────────────────────────────────────

test.describe("Scanner: Manual EAN lookup", () => {
  for (const { ean, description } of KNOWN_EANS) {
    test(`looks up ${description} (${ean}) and navigates to result`, async ({
      page,
    }) => {
      await lookupProductByEan(page, ean);

      // Should NOT show "Lookup failed"
      await expect(page.getByText("Lookup failed")).not.toBeVisible({
        timeout: 15_000,
      });

      // Found state renders on /app/scan first; navigate via View Details CTA.
      await expect(page.getByText(/Product Found/i)).toBeVisible({
        timeout: 30_000,
      });
      await page.getByRole("button", { name: /View Details/i }).click();

      // Should navigate to the scan result page
      await page.waitForURL(/\/app\/scan\/result\/\d+/, { timeout: 30_000 });

      // Result page should show product information
      await expect(page.locator("body")).not.toContainText("Lookup failed");
    });
  }

  test("unknown EAN shows not-found state (not an error)", async ({
    page,
  }) => {
    await lookupProductByEan(page, UNKNOWN_EAN);

    // Should NOT show "Lookup failed" (that's an error, not a not-found)
    await expect(page.getByText("Lookup failed")).not.toBeVisible({
      timeout: 15_000,
    });

    // Should show the not-found state with submit option
    await expect(
      page
        .getByText(/not found/i)
        .or(page.getByText(/submit/i))
        .or(page.getByText(/not in our database/i))
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("invalid EAN shows validation error (not API error)", async ({
    page,
  }) => {
    await page.goto("/app/scan");
    await disableNextDevOverlay(page);
    await page.getByRole("button", { name: /Manual/i }).click();

    const eanInput = page.getByPlaceholder(/Enter barcode/i);
    await eanInput.fill("123"); // too short

    // Short EAN may disable the button (client-side validation) or show an error
    const lookupBtn = page.getByRole("button", { name: /Look up/i });
    const isDisabled = await lookupBtn.isDisabled().catch(() => false);
    if (!isDisabled) {
      await lookupBtn.click();
    }

    // Should stay on scan page — validation prevents navigation
    await expect(page).toHaveURL(/\/app\/scan$/);
  });
});

// ─── Scan Result Page ──────────────────────────────────────────────────────

test.describe("Scanner: Result page", () => {
  test("result page renders product details after scan", async ({ page }) => {
    const ean = KNOWN_EANS[0].ean;

    await lookupProductByEan(page, ean);
    await page.getByRole("button", { name: /View Details/i }).click();

    await page.waitForURL(/\/app\/scan\/result\/\d+/, { timeout: 30_000 });

    // Should have product name visible
    await expect(
      page.locator("h1, h2, [data-testid='product-name']").first(),
    ).toBeVisible();

    // Should have a "Full Details" or similar link
    await expect(
      page
        .getByRole("link", { name: /full details/i })
        .or(page.getByRole("link", { name: /view product/i })),
    ).toBeVisible();

    // Should have "Scan Another" button
    await expect(
      page
        .getByRole("link", { name: /scan another/i })
        .or(page.getByRole("button", { name: /scan another/i }))
        .first(),
    ).toBeVisible();
  });

  test("result page shows healthier alternatives section", async ({
    page,
  }) => {
    const ean = KNOWN_EANS[0].ean;

    await lookupProductByEan(page, ean);
    await page.getByRole("button", { name: /View Details/i }).click();

    await page.waitForURL(/\/app\/scan\/result\/\d+/, { timeout: 30_000 });

    // Should have an alternatives section
    await expect(
      page
        .getByText(/healthier/i)
        .or(page.getByText(/alternatives/i))
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
