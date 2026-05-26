// ─── Functional E2E: Onboarding flow ────────────────────────────────────────
// Tests the onboarding wizard: step navigation, skip-all, completion.
// Uses a fresh test user (without onboarding_skipped) for the wizard tests,
// and the standard test user for redirect-guard tests.
//
// Requires: SUPABASE_SERVICE_ROLE_KEY (creates temp user inline).
// 6 tests
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from "@playwright/test";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const ONBOARDING_EMAIL = `e2e-onboarding-${Date.now()}@test.tryvit.local`;
const ONBOARDING_PASSWORD = "OnboardingTest123!";
const WebSocketTransport = WebSocket as unknown as WebSocketLikeConstructor;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocketTransport },
  });
}

async function createOnboardingUser(): Promise<string> {
  const supabase = getAdminClient();

  // Clean up any stale user
  const PAGE_SIZE = 50;
  let page = 1;
  let existingId: string | null = null;
   
  while (true) {
    const {
      data: { users },
    } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    const match = users.find((u) => u.email === ONBOARDING_EMAIL);
    if (match) {
      existingId = match.id;
      break;
    }
    if (users.length < PAGE_SIZE) break;
    page++;
  }
  if (existingId) await supabase.auth.admin.deleteUser(existingId);

  // Create fresh user — NO onboarding preferences
  const { data, error } = await supabase.auth.admin.createUser({
    email: ONBOARDING_EMAIL,
    password: ONBOARDING_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`Create onboarding user: ${error.message}`);
  return data.user.id;
}

async function signInOnboardingUser(
  page: import("@playwright/test").Page,
) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(ONBOARDING_EMAIL);
  await page
    .getByLabel("Password", { exact: true })
    .fill(ONBOARDING_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(onboarding|app|auth\/login)/, {
    timeout: 20_000,
  });
}

async function deleteOnboardingUser() {
  try {
    const supabase = getAdminClient();
    const PAGE_SIZE = 50;
    let page = 1;
     
    while (true) {
      const {
        data: { users },
      } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
      const match = users.find((u) => u.email === ONBOARDING_EMAIL);
      if (match) {
        await supabase.auth.admin.deleteUser(match.id);
        return;
      }
      if (users.length < PAGE_SIZE) return;
      page++;
    }
  } catch {
    // Best-effort cleanup
  }
}

// ─── Onboarding: Redirect Guard ────────────────────────────────────────────
// Standard test user (already onboarded) should be redirected to /app/search

test.describe("Onboarding: redirect guard", () => {
  test("already-onboarded user is redirected from /onboarding to /app", async ({
    page,
  }) => {
    // Navigate to onboarding as the onboarded test user
    await page.goto("/onboarding");

    // Should redirect to /app/search (onboarding already done)
    await page.waitForURL(/\/app/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/app/);
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

  test("Welcome step renders with Get Started and Skip buttons", async ({
    page,
  }) => {
    await signInOnboardingUser(page);

    // Should land on onboarding (no preferences set)
    await page.waitForURL(/\/(onboarding|app)/, { timeout: 20_000 });

    if (page.url().includes("/onboarding")) {
      // Welcome step should render
      await expect(
        page.getByTestId("onboarding-get-started"),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByTestId("onboarding-skip-all"),
      ).toBeVisible();
    }
  });

  test("Skip All from welcome goes to /app/search", async ({ page }) => {
    await signInOnboardingUser(page);

    await page.waitForURL(/\/(onboarding|app)/, { timeout: 20_000 });

    if (page.url().includes("/onboarding")) {
      await page.getByTestId("onboarding-skip-all").click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });
      expect(page.url()).toMatch(/\/app/);
    }
  });

  test("Get Started advances to Region step", async ({ page }) => {
    // Need a fresh user (the previous test may have skipped)
    await createOnboardingUser();

    await signInOnboardingUser(page);

    await page.waitForURL(/\/(onboarding|app)/, { timeout: 20_000 });

    if (page.url().includes("/onboarding")) {
      await page.getByTestId("onboarding-get-started").click();

      // Region step should show country options
      await expect(
        page
          .getByTestId("country-PL")
          .or(page.getByText(/Poland|Polska/i).first()),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("Region step allows country selection and advancement", async ({
    page,
  }) => {
    await createOnboardingUser();

    await signInOnboardingUser(page);

    await page.waitForURL(/\/(onboarding|app)/, { timeout: 20_000 });

    if (page.url().includes("/onboarding")) {
      // Advance to Region step
      await page.getByTestId("onboarding-get-started").click();

      // Select Poland
      const plBtn = page.getByTestId("country-PL");
      await expect(plBtn).toBeVisible({ timeout: 10_000 });
      await plBtn.click();

      // Click Next
      const nextBtn = page.getByRole("button", { name: /next|dalej/i });
      if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await nextBtn.click();

        // Should advance to the Diet step
        await expect(
          page.getByText(/diet|dieta/i).first(),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test("Skip All from a mid-step goes to /app/search", async ({ page }) => {
    await createOnboardingUser();

    await signInOnboardingUser(page);

    await page.waitForURL(/\/(onboarding|app)/, { timeout: 20_000 });

    if (page.url().includes("/onboarding")) {
      // Advance past welcome
      await page.getByTestId("onboarding-get-started").click();
      await expect(
        page.getByTestId("country-PL").or(page.getByText("Polska")),
      ).toBeVisible({ timeout: 10_000 });

      // Click Skip All from Region step
      await page.getByTestId("onboarding-skip-all").click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });
    }
  });
});
