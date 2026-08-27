import { expect, test } from "./fixtures/safe-test";

// ─── Form Validation UX E2E Tests ──────────────────────────────────────────
// Issue #69: Verify forms have proper structure, labels, required attributes,
// and native validation behavior on public auth pages.

test.describe("Login form validation UX", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login");
  });

  test("has properly labeled email and password fields", async ({ page }) => {
    const emailLabel = page.locator('label[for="email"]');
    const passwordLabel = page.locator('label[for="password"]');

    await expect(emailLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();

    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");

    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("email and password fields are required", async ({ page }) => {
    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");

    await expect(emailInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("required", "");
  });

  test("submit button is present and has correct type", async ({ page }) => {
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeVisible();
    await expect(submit).toHaveAttribute("type", "submit");
  });

  test("tab order follows logical flow: email → password → toggle → forgot → submit", async ({
    page,
  }) => {
    const emailInput = page.locator("#email");
    if (await emailInput.isDisabled()) {
      await expect(page.getByText(/account access is temporarily unavailable/i)).toBeVisible();
      return;
    }
    await emailInput.focus();
    await expect(emailInput).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.locator("#password")).toBeFocused();

    // Password toggle button
    await page.keyboard.press("Tab");
    // Forgot password link
    await page.keyboard.press("Tab");

    await page.keyboard.press("Tab");
    await expect(page.locator('button[type="submit"]')).toBeFocused();
  });

  test("empty form submission is blocked by native validation", async ({
    page,
  }) => {
    const submit = page.locator('button[type="submit"]');
    if (await submit.isDisabled()) {
      await expect(page.getByText(/account access is temporarily unavailable/i)).toBeVisible();
      await expect(page).toHaveURL(/\/auth\/login/);
      return;
    }
    await submit.click();

    // Page should NOT navigate (form blocked by required validation)
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("Private-beta signup UX", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/signup");
  });

  test("signup route CSP allows Cloudflare Turnstile framing", async ({
    page,
  }) => {
    const response = await page.goto("/auth/signup");
    const csp = response?.headers()["content-security-policy"] ?? "";

    expect(csp).toContain("frame-src");
    expect(csp).toContain("https://challenges.cloudflare.com");
  });

  test("has no email, password, social, or Turnstile signup controls", async ({ page }) => {
    await expect(page.locator("#email")).toHaveCount(0);
    await expect(page.locator("#password")).toHaveCount(0);
    await expect(page.getByTestId("turnstile-widget")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /continue with/i })).toHaveCount(0);
    await expect(page.locator('button[type="submit"]')).toHaveCount(0);
  });

  test("form has accessible structure with heading", async ({ page }) => {
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  test("offers login and password recovery", async ({ page }) => {
    await expect(page.getByRole("link", { name: /sign in \/ continue/i })).toHaveAttribute(
      "href",
      /\/auth\/login\?redirect=/u,
    );
    await expect(page.getByRole("link", { name: /recover invited account/i })).toHaveAttribute(
      "href",
      /\/auth\/forgot-password\?redirect=/u,
    );
  });
});

test.describe("Auth destination and recovery continuity", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("preserves a protected deep link through invite and recovery entry", async ({ page }) => {
    await page.goto("/app/product/42?tab=nutrition");
    await page.waitForURL(/\/auth\/login/u);

    let current = new URL(page.url());
    expect(current.searchParams.get("redirect")).toBe("/app/product/42?tab=nutrition");

    await page.getByRole("link", { name: /how private beta works/i }).click();
    await page.waitForURL(/\/auth\/signup/u);
    current = new URL(page.url());
    expect(current.pathname).toBe("/auth/signup");
    expect(current.searchParams.get("redirect")).toBe("/app/product/42?tab=nutrition");

    await page.getByRole("link", { name: /sign in \/ continue/i }).click();
    await page.waitForURL(/\/auth\/login/u);
    await page.getByRole("link", { name: /forgot password/i }).click();
    await page.waitForURL(/\/auth\/forgot-password/u);
    current = new URL(page.url());
    expect(current.pathname).toBe("/auth/forgot-password");
    expect(current.searchParams.get("redirect")).toBe("/app/product/42?tab=nutrition");

    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
  });

  test("renders provider and expired-link failures as recoverable login states", async ({ page }) => {
    await page.goto("/auth/login?reason=provider&redirect=%2Fapp%2Fsearch");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      /provider could not complete/i,
    );

    await page.goto("/auth/login?reason=expired&redirect=%2Fapp%2Fsearch");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      /session has expired/i,
    );
  });
});
