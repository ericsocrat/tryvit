// ─── Authenticated E2E tests ────────────────────────────────────────────────
// These tests run with pre-authenticated storageState produced by auth.setup.ts.
// The test user has completed onboarding (Poland, default preferences).
//
// No camera dependency — all interactions are keyboard / click.
// Deterministic — each run starts from a known auth + onboarding state.

import { expect, test } from "./fixtures/safe-test";

// ─── Mobile viewport overflow guard ────────────────────────────────────────
// Regression test for the mobile "zoomed out" bug fixed in PR #92.
// <dialog> elements with max-w-lg (512px) inflated the layout viewport on
// Android Chrome. This ensures no authenticated page overflows on mobile.

const RESPONSIVE_VIEWPORTS = [
  { name: "320px (iPhone SE)", width: 320, height: 568 },
  { name: "375px (iPhone)", width: 375, height: 812 },
  { name: "768px (tablet)", width: 768, height: 1024 },
  { name: "1024px (laptop)", width: 1024, height: 768 },
] as const;

const APP_PAGES = ["/app", "/app/search", "/app/settings", "/app/categories"];

for (const viewport of RESPONSIVE_VIEWPORTS) {
  test.describe(`No horizontal overflow at ${viewport.name} (authenticated)`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
    });

    for (const path of APP_PAGES) {
      test(`${path} has no horizontal scroll`, async ({ page }) => {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        const scrollWidth = await page.evaluate(
          () => document.documentElement.scrollWidth,
        );
        const innerWidth = await page.evaluate(() => window.innerWidth);
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
      });
    }
  });
}

// ─── Invitation-only signup boundary (public, no auth needed) ───────────────
// Clear storageState so the middleware does NOT redirect /auth/signup → /app.

test.describe("Private-beta signup boundary", () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 390, height: 844 },
  });

  test("local Auth rejects direct self-service signup", async ({ request }) => {
    const supabaseOrigin = process.env.VISUAL_SAFETY_SUPABASE_ORIGIN;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseOrigin || !anonKey) {
      throw new Error("Guarded local Supabase credentials are unavailable");
    }
    expect(supabaseOrigin).toMatch(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/u);

    const response = await request.post(`${supabaseOrigin}/auth/v1/signup`, {
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
      },
      data: {
        email: "blocked-private-beta@tryvit.invalid",
        password: "BlockedSignup123!",
      },
    });
    const payload = (await response.json()) as {
      error_code?: string;
      message?: string;
      msg?: string;
    };

    expect(response.status()).toBe(422);
    expect(payload.error_code).toBe("signup_disabled");
    expect(payload.message ?? payload.msg).toMatch(/signups not allowed/i);
  });

  test("renders no signup or verification transport", async ({ page }) => {
    const disallowedRequests: string[] = [];
    page.on("request", (request) => {
      if (
        request.url().includes("challenges.cloudflare.com") ||
        request.url().includes("/auth/v1/signup") ||
        request.url().includes("/functions/v1/verify-turnstile")
      ) {
        disallowedRequests.push(request.url());
      }
    });
    await page.goto("/auth/signup");
    await expect(
      page.getByRole("heading", { name: /private beta access is invitation-only/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveCount(0);
    await expect(page.getByTestId("turnstile-widget")).toHaveCount(0);
    expect(disallowedRequests).toEqual([]);
  });

  test("navigates invited users to login", async ({ page }) => {
    await page.goto("/auth/signup");
    await page.getByRole("link", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });
});

// ─── Authenticated: Search ──────────────────────────────────────────────────

test.describe("Search page", () => {
  test("renders with search input", async ({ page }) => {
    await page.goto("/app/search");
    await expect(page.getByPlaceholder(/search products/i)).toBeVisible();
  });

  test("can type and submit a query", async ({ page }) => {
    await page.goto("/app/search");

    const input = page.getByPlaceholder(/search products/i);
    await input.fill("milk");
    await input.press("Enter");

    // Should stay on search page (results or empty state)
    await expect(page).toHaveURL(/\/app\/search/);
  });

  test("shows recent searches in autocomplete dropdown", async ({ page }) => {
    // Seed localStorage with recent searches before navigating
    await page.goto("/app/search");
    await page.evaluate(() => {
      localStorage.setItem(
        "tryvit:recent-searches",
        JSON.stringify(["mleko", "jogurt"]),
      );
    });
    // Reload to pick up seeded data
    await page.reload({ waitUntil: "domcontentloaded" });

    const input = page.getByPlaceholder(/search products/i);
    // autoFocus may have focused the input before React hydrates,
    // so blur first to guarantee the subsequent focus fires the event.
    await input.blur();
    await input.focus();

    // Recent searches section should appear
    const dropdown = page.locator("#search-autocomplete-listbox");
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await expect(dropdown.getByText("mleko").first()).toBeVisible();
    await expect(dropdown.getByText("jogurt").first()).toBeVisible();
  });
});

// ─── Authenticated: Categories ──────────────────────────────────────────────

test.describe("Categories page", () => {
  test("renders category overview", async ({ page }) => {
    await page.goto("/app/categories");

    // Should show the categories heading or grid
    await expect(page.locator("body")).toContainText(/categor/i);
  });
});

// ─── Authenticated: Product detail ─────────────────────────────────────────

test.describe("Product detail", () => {
  test("handles non-existent product gracefully", async ({ page }) => {
    await page.goto("/app/product/999999");

    // Should not crash — may show error, not-found, or fallback UI
    await expect(page.locator("body")).toBeVisible();
    // Should NOT redirect to login (user IS authenticated)
    expect(page.url()).not.toMatch(/\/auth\/login/);
  });
});

// ─── Authenticated: Settings ────────────────────────────────────────────────

test.describe("Settings page", () => {
  test("renders profile settings heading", async ({ page }) => {
    await page.goto("/app/settings");
    await expect(
      page.getByRole("heading", { name: /Profile/i }),
    ).toBeVisible();
  });

  test("shows country preference", async ({ page }) => {
    await page.goto("/app/settings");
    await page.waitForLoadState("domcontentloaded");

    // We onboarded with Poland — button text shows native name "Polska"
    await expect(
      page.locator("button").filter({ hasText: "Polska" }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows diet and allergen options on nutrition tab", async ({ page }) => {
    await page.goto("/app/settings/nutrition");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText(/diet/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/allergen/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ─── Authenticated: Logout ─────────────────────────────────────────────────

async function containSharedFixtureLogout(page: Page): Promise<void> {
  await page.route("**/auth/v1/logout**", (route) =>
    route.fulfill({ status: 204 }),
  );
}

test.describe("Logout flow", () => {
  test("sign-out redirects to login page", async ({ page }) => {
    // Exercise the client logout flow without revoking the shared server-side
    // fixture session required by later catalog and cross-browser projects.
    await containSharedFixtureLogout(page);
    await page.goto("/app/settings/account");
    await page.waitForLoadState("domcontentloaded");

    const signOutBtn = page.getByRole("button", { name: /sign out/i });
    await expect(signOutBtn).toBeVisible({ timeout: 10_000 });
    await signOutBtn.click();

    // Should redirect to login
    await page.waitForURL(/\/auth\/login/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("after sign-out, protected routes redirect to login", async ({
    page,
  }) => {
    await containSharedFixtureLogout(page);
    // Navigate to settings and sign out
    await page.goto("/app/settings/account");
    await page.waitForLoadState("domcontentloaded");

    // Page may have redirected to login if auth session expired
    if (page.url().includes("/auth/login")) {
      // Already on login — session expired, verify protected route still redirects
      await page.goto("/app/search");
      await page.waitForURL(/\/auth\/login/, { timeout: 10_000 });
      return;
    }

    await page
      .getByRole("button", { name: /sign out|log out/i })
      .click({ timeout: 15_000 });
    await page.waitForURL(/\/auth\/login/, { timeout: 15_000 });

    // Attempt to visit a protected route
    await page.goto("/app/search");
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 });
  });
});
