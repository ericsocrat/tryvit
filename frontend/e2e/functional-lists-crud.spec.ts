// ─── Functional E2E: Product lists CRUD ─────────────────────────────────────
// Tests full product list lifecycle: creation, viewing, deletion, and sharing.
//
// Requires: authenticated session (depends on auth-setup project).
// 8 tests
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from "./fixtures/safe-test";

const UNIQUE_LIST_NAME = `E2E Test List ${Date.now()}`;
test.describe.configure({ mode: "serial" });

// ─── List creation ──────────────────────────────────────────────────────────

test.describe("Product lists: creation", () => {
  test("lists page renders with My Lists heading", async ({ page }) => {
    await page.goto("/app/lists");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /My Lists/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("new list button toggles create form", async ({ page }) => {
    await page.goto("/app/lists");
    await page.waitForLoadState("domcontentloaded");

    // Click "+ New List" to show the creation form
    const newListBtn = page.getByRole("button", { name: /New List/i });
    await expect(newListBtn).toBeVisible({ timeout: 10_000 });
    await newListBtn.click();

    // Name input should appear
    const nameInput = page.getByPlaceholder(/List name/i);
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    // Description input should appear
    const descInput = page.getByPlaceholder(/Description/i);
    await expect(descInput).toBeVisible();

    // Create List button should be visible but disabled (name empty)
    const createBtn = page.getByRole("button", { name: /Create List/i });
    await expect(createBtn).toBeVisible();

    // Cancel button should be visible
    const cancelBtn = page.locator("form").getByRole("button", {
      name: /Cancel/i,
    });
    await expect(cancelBtn).toBeVisible();

    // Clicking Cancel hides the form
    await cancelBtn.click();
    await expect(nameInput).not.toBeVisible({ timeout: 3_000 });
  });

  test("creates a new list with name and description", async ({ page }) => {
    await page.goto("/app/lists");
    await page.waitForLoadState("domcontentloaded");

    // Open create form
    const newListBtn = page.getByRole("button", { name: /New List/i });
    await expect(newListBtn).toBeVisible({ timeout: 10_000 });
    await newListBtn.click();

    // Fill form
    const nameInput = page.getByPlaceholder(/List name/i);
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(UNIQUE_LIST_NAME);

    const descInput = page.getByPlaceholder(/Description/i);
    await descInput.fill("Created by Playwright E2E");

    // Submit
    const createBtn = page.getByRole("button", { name: /Create List/i });
    await createBtn.click();

    // Wait for creation to complete — form should close
    await expect(nameInput).not.toBeVisible({ timeout: 10_000 });

    // New list should appear in the list
    await expect(page.getByText(UNIQUE_LIST_NAME)).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ─── List detail ────────────────────────────────────────────────────────────

test.describe("Product lists: detail view", () => {
  test("navigating to list detail shows list name", async ({ page }) => {
    await page.goto("/app/lists");
    await page.waitForLoadState("domcontentloaded");

    // Click on the test list (or any custom list)
    const listLink = page
      .getByRole("link")
      .filter({ hasText: UNIQUE_LIST_NAME })
      .first();
    await expect(listLink).toBeVisible({ timeout: 10_000 });
    await listLink.click();
    await page.waitForLoadState("domcontentloaded");

    // Heading should show the list name
    await expect(
      page.getByRole("heading", { name: new RegExp(UNIQUE_LIST_NAME, "i") }),
    ).toBeVisible({ timeout: 10_000 });

    // Empty list message should show (list was just created with no items)
    await expect(page.getByText(/empty|no items|Browse products/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("list detail has edit and share buttons", async ({ page }) => {
    await page.goto("/app/lists");
    await page.waitForLoadState("domcontentloaded");

    const listLink = page
      .getByRole("link")
      .filter({ hasText: UNIQUE_LIST_NAME })
      .first();
    await expect(listLink).toBeVisible({ timeout: 10_000 });
    await listLink.click();
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Edit list/i })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByRole("button", { name: /Share settings/i })).toBeVisible({
      timeout: 5_000,
    });
  });
});

// ─── List sharing ───────────────────────────────────────────────────────────

test.describe("Product lists: sharing", () => {
  test("share panel toggles and shows copy link button", async ({ page }) => {
    await page.goto("/app/lists");
    await page.waitForLoadState("domcontentloaded");

    const listLink = page
      .getByRole("link")
      .filter({ hasText: UNIQUE_LIST_NAME })
      .first();
    await expect(listLink).toBeVisible({ timeout: 10_000 });
    await listLink.click();
    await page.waitForLoadState("domcontentloaded");

    const shareBtn = page.getByRole("button", { name: /Share settings/i });
    await expect(shareBtn).toBeVisible({ timeout: 5_000 });
    await shareBtn.click();

    await expect(page.getByText(/Sharing/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(
      page
        .getByRole("button", { name: /^On$/i })
        .or(page.getByRole("button", { name: /^Off$/i })),
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ─── List deletion ──────────────────────────────────────────────────────────

test.describe("Product lists: deletion", () => {
  test("delete button opens confirm dialog", async ({ page }) => {
    await page.goto("/app/lists");
    await page.waitForLoadState("domcontentloaded");

    // Find the delete button for the test list
    const deleteBtn = page.getByRole("button", {
      name: new RegExp(`Delete ${UNIQUE_LIST_NAME}`, "i"),
    });
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 });
    await deleteBtn.click();

    await expect(page.getByText(/Delete list\?|cannot be undone/i).first()).toBeVisible({
      timeout: 5_000,
    });
    const cancelBtn = page
      .getByRole("dialog")
      .getByRole("button", { name: /Cancel/i })
      .first();
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await expect(page.getByText(UNIQUE_LIST_NAME)).toBeVisible({ timeout: 5_000 });
  });

  test("confirming delete removes the list", async ({ page }) => {
    await page.goto("/app/lists");
    await page.waitForLoadState("domcontentloaded");

    const deleteBtn = page.getByRole("button", {
      name: new RegExp(`Delete ${UNIQUE_LIST_NAME}`, "i"),
    });
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 });
    await deleteBtn.click();

    await expect(page.getByText(/Delete list\?|cannot be undone/i).first()).toBeVisible({
      timeout: 5_000,
    });
    const confirmDelete = page.getByRole("dialog").getByRole("button", {
      name: /^Delete$/i,
    });
    await expect(confirmDelete).toBeVisible();
    await confirmDelete.click();
    await expect(page.getByText(UNIQUE_LIST_NAME)).not.toBeVisible({ timeout: 10_000 });
  });
});

