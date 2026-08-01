// ─── PR Screenshots — Smart Screenshot Capture for Changed Pages ────────────
// Captures mobile + desktop screenshots ONLY for pages affected by the
// current branch's file changes. Used for both local self-review and CI
// PR verification.
//
// Local-authenticated mode creates a test user and signs in via the UI after
// the checked-in emulator passes the guard. Public mode never provisions one.
//
// How it determines which pages to capture:
//   1. Reads CHANGED_FILES env var (newline-separated paths, set by runner)
//   2. Falls back to `git diff --name-only main...HEAD`
//   3. Maps file paths to page URLs via page-map.ts
//
// Usage:
//   # From the repository root; the explicit mode is mandatory:
//   pwsh ./RUN_PR_SCREENSHOTS.ps1 -Mode Public
//   pwsh ./RUN_PR_SCREENSHOTS.ps1 -Mode LocalAuthenticated -All
//
// The runner owns the clean build, server, browser guard, and cleanup. Do not
// invoke this project through a raw Playwright command.
//
// Output: frontend/pr-screenshots/{mobile,desktop}/

import { expect, test, type Page, visualSafetyMode } from "./fixtures/safe-test";
import fs from "node:fs";
import path from "node:path";
import { getChangedPages, PAGE_MAP } from "./helpers/page-map";
import { getGuardedFixtureRequest } from "./helpers/test-user";
import { VisualSafetyError } from "./helpers/visual-safety";

/* ── Constants ───────────────────────────────────────────────────────────── */

const OUTPUT_ROOT = path.resolve(__dirname, "../pr-screenshots");
const MOBILE_DIR = path.join(OUTPUT_ROOT, "mobile");
const DESKTOP_DIR = path.join(OUTPUT_ROOT, "desktop");

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

const TEST_EMAIL = "pr-screenshots@test.tryvit.local";
const TEST_PASSWORD = "PrScreenshot123!";

/* ── Helper functions ────────────────────────────────────────────────────── */

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function stabilizePage(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
  await page.waitForTimeout(500);
}

async function captureScreenshot(page: Page, dir: string, filename: string) {
  ensureDir(dir);
  const filepath = path.join(dir, filename);
  await page.screenshot({
    path: filepath,
    fullPage: false,
    animations: "disabled",
  });
  console.log(`  ✅ ${filepath}`);
}

/* ── Auth: Self-contained user provisioning ──────────────────────────────── */

let testUserId: string | null = null;

function getSupabaseConfig() {
  const runtime = getGuardedFixtureRequest();
  return {
    url: runtime.origin,
    key: runtime.serviceRoleKey,
    guardedFetch: runtime.fetch,
  };
}

async function provisionTestUser(): Promise<string> {
  if (testUserId) return testUserId;

  const { url, key, guardedFetch } = getSupabaseConfig();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  // Check if user already exists
  const listRes = await guardedFetch(`${url}/auth/v1/admin/users`, { headers });
  if (!listRes.ok) {
    throw new VisualSafetyError("VS_FIXTURE_ADMIN", "pr-screenshot-user-list");
  }
  const listData = await listRes.json();
  const existing = listData.users?.find((u: { email: string }) => u.email === TEST_EMAIL);
  if (existing) {
    testUserId = existing.id;
    return testUserId;
  }

  // Create fresh user
  const createRes = await guardedFetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    }),
  });

  if (createRes.status === 422) {
    const retryList = await guardedFetch(`${url}/auth/v1/admin/users`, { headers });
    if (!retryList.ok) {
      throw new VisualSafetyError("VS_FIXTURE_ADMIN", "pr-screenshot-user-retry-list");
    }
    const retryData = await retryList.json();
    const found = retryData.users?.find((u: { email: string }) => u.email === TEST_EMAIL);
    if (found) {
      testUserId = found.id;
      return testUserId;
    }
  }

  if (!createRes.ok) {
    throw new Error("[VS_FIXTURE_ADMIN] pr-screenshot-user-create");
  }

  const userData = await createRes.json();
  testUserId = userData.id;

  // Pre-create preferences (skip onboarding, force English)
  const preferencesRes = await guardedFetch(`${url}/rest/v1/user_preferences`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: testUserId,
      country: "PL",
      preferred_language: "en",
      onboarding_completed: false,
      onboarding_skipped: true,
    }),
  });
  if (!preferencesRes.ok) {
    throw new VisualSafetyError(
      "VS_FIXTURE_ADMIN",
      "pr-screenshot-preferences-upsert",
    );
  }

  return userData.id;
}

async function signInViaUI(page: Page) {
  await page.goto("/auth/login");
  await page.waitForLoadState("domcontentloaded");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(app\/search|onboarding)/, { timeout: 30_000 });

  if (page.url().includes("/onboarding")) {
    const skipBtn = page.getByTestId("onboarding-skip-all");
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
      await page.waitForURL(/\/app\/search/, { timeout: 10_000 });
    }
  }
}

async function cleanupTestUser() {
  const { url, key, guardedFetch } = getSupabaseConfig();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  const listRes = await guardedFetch(`${url}/auth/v1/admin/users`, { headers });
  if (!listRes.ok) {
    throw new VisualSafetyError("VS_FIXTURE_ADMIN", "pr-screenshot-user-cleanup-list");
  }
  const listData = await listRes.json();
  const user = listData.users?.find((u: { email: string }) => u.email === TEST_EMAIL);
  if (user) {
    const deleteRes = await guardedFetch(`${url}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers,
    });
    if (!deleteRes.ok) {
      throw new VisualSafetyError("VS_FIXTURE_ADMIN", "pr-screenshot-user-cleanup-delete");
    }
  }
  testUserId = null;
}

/* ── Determine which pages to capture ────────────────────────────────────── */

const changedPages = process.env.PR_SCREENSHOTS_ALL === "true" ? PAGE_MAP : getChangedPages();
const selectedPages = changedPages.filter((page) =>
  visualSafetyMode === "public" ? !page.auth : page.auth,
);
const publicPages = selectedPages.filter((p) => !p.auth);
const authPages = selectedPages.filter((p) => p.auth);
console.log(
  `\n📸 PR Screenshots: ${selectedPages.length} ${visualSafetyMode} page(s) to capture\n` +
    selectedPages.map((p) => `  • ${p.label} → ${p.url}`).join("\n"),
);

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

/* ── Public pages (no auth needed) ───────────────────────────────────────── */

if (publicPages.length > 0) {
  test.describe("Public pages", () => {
    for (const entry of publicPages) {
      test(`${entry.label} — mobile`, async ({ page }) => {
        await page.setViewportSize(MOBILE_VIEWPORT);
        await page.goto(entry.url);
        await stabilizePage(page);
        await expect(page.locator("body")).toBeVisible();
        await captureScreenshot(page, MOBILE_DIR, `${entry.label}.png`);
      });

      test(`${entry.label} — desktop`, async ({ page }) => {
        await page.setViewportSize(DESKTOP_VIEWPORT);
        await page.goto(entry.url);
        await stabilizePage(page);
        await expect(page.locator("body")).toBeVisible();
        await captureScreenshot(page, DESKTOP_DIR, `${entry.label}.png`);
      });
    }
  });
}

/* ── Authenticated pages ─────────────────────────────────────────────────── */

if (authPages.length > 0) {
  test.describe("Authenticated pages", () => {
    test.beforeAll(async () => {
      await provisionTestUser();
    });

    test.afterAll(async () => {
      await cleanupTestUser();
    });

    for (const entry of authPages) {
      test(`${entry.label} — mobile`, async ({ page }) => {
        // Every Playwright test receives a fresh context/page. Authenticate
        // each one rather than carrying process-local state across tests.
        await signInViaUI(page);
        await page.setViewportSize(MOBILE_VIEWPORT);
        await page.goto(entry.url);
        await stabilizePage(page);
        await expect(page.locator("body")).toBeVisible();
        await captureScreenshot(page, MOBILE_DIR, `${entry.label}.png`);
      });

      test(`${entry.label} — desktop`, async ({ page }) => {
        await signInViaUI(page);
        await page.setViewportSize(DESKTOP_VIEWPORT);
        await page.goto(entry.url);
        await stabilizePage(page);
        await expect(page.locator("body")).toBeVisible();
        await captureScreenshot(page, DESKTOP_DIR, `${entry.label}.png`);
      });
    }
  });
}

/* ── Skip notice ─────────────────────────────────────────────────────────── */

if (selectedPages.length === 0) {
  test("No pages to screenshot for the selected safety mode", () => {
    console.log(`ℹ️  No changed files matched ${visualSafetyMode} pages. Nothing to capture.`);
    expect(selectedPages).toHaveLength(0);
  });
}
