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
    await expect(page.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/auth/login",
    );
    await expect(page.getByRole("link", { name: /forgot password/i })).toHaveAttribute(
      "href",
      "/auth/forgot-password",
    );
  });
});
