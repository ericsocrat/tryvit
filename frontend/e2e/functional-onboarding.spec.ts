// ─── Functional E2E: Onboarding flow ────────────────────────────────────────
// Tests the onboarding wizard: step navigation, skip-all, completion.
// Uses a fresh test user (without onboarding_skipped) for the wizard tests,
// and the standard test user for redirect-guard tests.
//
// Requires explicit local-authenticated mode (creates a local temp user).
// 6 tests
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test, type Page } from "./fixtures/safe-test";
import { getAdminClient } from "./helpers/test-user";
import { VisualSafetyError } from "./helpers/visual-safety";

const ONBOARDING_EMAIL = `e2e-onboarding-${Date.now()}@test.tryvit.local`;
const ONBOARDING_PASSWORD = "OnboardingTest123!";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createOnboardingUser(): Promise<string> {
  const supabase = getAdminClient();

  // Clean up any stale user
  const PAGE_SIZE = 50;
  let page = 1;
  let existingId: string | null = null;
   
  while (true) {
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      throw new VisualSafetyError(
        "VS_FIXTURE_ADMIN",
        "onboarding-user-list",
      );
    }
    const match = users.find((u) => u.email === ONBOARDING_EMAIL);
    if (match) {
      existingId = match.id;
      break;
    }
    if (users.length < PAGE_SIZE) break;
    page++;
  }
  if (existingId) {
    const { error } = await supabase.auth.admin.deleteUser(existingId);
    if (error) {
      throw new VisualSafetyError(
        "VS_FIXTURE_ADMIN",
        "onboarding-user-delete",
      );
    }
  }

  // Create fresh user — NO onboarding preferences
  const { data, error } = await supabase.auth.admin.createUser({
    email: ONBOARDING_EMAIL,
    password: ONBOARDING_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error("[VS_FIXTURE_ADMIN] onboarding-user-create");
  return data.user.id;
}

async function signInOnboardingUser(page: Page) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(ONBOARDING_EMAIL);
  await page
    .getByLabel("Password", { exact: true })
    .fill(ONBOARDING_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/onboarding$/, {
    timeout: 20_000,
  });
}

async function deleteOnboardingUser() {
  const supabase = getAdminClient();
  const PAGE_SIZE = 50;
  let page = 1;

  while (true) {
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      throw new VisualSafetyError(
        "VS_FIXTURE_ADMIN",
        "onboarding-user-cleanup-list",
      );
    }
    const match = users.find((u) => u.email === ONBOARDING_EMAIL);
    if (match) {
      const { error: deleteError } =
        await supabase.auth.admin.deleteUser(match.id);
      if (deleteError) {
        throw new VisualSafetyError(
          "VS_FIXTURE_ADMIN",
          "onboarding-user-cleanup-delete",
        );
      }
      return;
    }
    if (users.length < PAGE_SIZE) return;
    page++;
  }
}

// ─── Onboarding: Redirect Guard ────────────────────────────────────────────
// Standard test user (already onboarded) should be redirected to /app/search

test.describe("Onboarding: redirect guard", () => {
  test("already-onboarded user is redirected from /onboarding to Search", async ({
    page,
  }) => {
    // Navigate to onboarding as the onboarded test user
    await page.goto("/onboarding");

    // Should redirect to /app/search (onboarding already done)
    await page.waitForURL(/\/app\/search$/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/app\/search$/);
  });
});

// ─── Onboarding: Wizard Flow ────────────────────────────────────────────────
// Fresh user with NO preferences — should see the wizard

test.describe("Onboarding: wizard flow", () => {
  test.describe.configure({ mode: "serial" });

  // Clear the standard auth state — we'll log in manually
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    await createOnboardingUser();
  });

  test.afterAll(async () => {
    await deleteOnboardingUser();
  });

  test("combined welcome and region step exposes country, Continue, and Skip", async ({
    page,
  }, testInfo) => {
    await signInOnboardingUser(page);

    await expect(page.getByTestId("country-PL")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("country-DE")).toBeVisible();
    await expect(page.getByTestId("onboarding-get-started")).toBeDisabled();
    await expect(page.getByTestId("onboarding-skip-all")).toBeVisible();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: testInfo.outputPath("batch1-onboarding-390-light.png"),
      animations: "disabled",
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
      document.documentElement.setAttribute("data-theme", "dark");
    });
    await page.screenshot({
      path: testInfo.outputPath("batch1-onboarding-1440-dark.png"),
      animations: "disabled",
    });
  });

  test("Skip from the first step enters the first-use dashboard", async ({ page }) => {
    await signInOnboardingUser(page);

    await page.getByTestId("onboarding-skip-all").click();
    await page.waitForURL(/\/app$/, { timeout: 15_000 });
    await expect(page.getByTestId("new-user-welcome")).toBeVisible();
  });

  test("country selection advances directly to Diet and Allergens", async ({
    page,
  }) => {
    await createOnboardingUser();
    await signInOnboardingUser(page);

    await page.getByTestId("country-PL").click();
    await expect(page.getByTestId("onboarding-get-started")).toBeEnabled();
    await page.getByTestId("onboarding-get-started").click();

    await expect(page.getByTestId("diet-none")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("allergen-gluten")).toBeVisible();
  });

  test("three-step completion saves and enters the first-use dashboard", async ({ page }) => {
    await createOnboardingUser();
    await signInOnboardingUser(page);

    await page.getByTestId("country-PL").click();
    await page.getByTestId("onboarding-get-started").click();
    await page.getByTestId("diet-vegetarian").click();
    await page.getByRole("button", { name: /next|dalej/i }).click();
    await expect(page.getByTestId("goal-diabetes")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("goal-diabetes").click();
    await page.getByTestId("category-bread").click();
    await page.getByTestId("onboarding-complete").click();

    await page.waitForURL(/\/app$/, { timeout: 20_000 });
    await expect(page.getByTestId("new-user-welcome")).toBeVisible();
  });

  test("Skip from an inner step enters the first-use dashboard", async ({ page }) => {
    await createOnboardingUser();
    await signInOnboardingUser(page);

    await page.getByTestId("country-DE").click();
    await page.getByTestId("onboarding-get-started").click();
    await expect(page.getByTestId("onboarding-skip-all")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("onboarding-skip-all").click();
    await page.waitForURL(/\/app$/, { timeout: 15_000 });
    await expect(page.getByTestId("new-user-welcome")).toBeVisible();
  });
});
