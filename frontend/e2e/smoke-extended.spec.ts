import { expect, test } from "./fixtures/safe-test";

// ─── Extended smoke tests: deeper coverage of public pages ──────────────────
// All tests are public-page only — no Supabase auth dependency.

test.describe("Unknown routes", () => {
  test("unknown route redirects to login", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await page.waitForURL(/\/auth\/login/);
    await expect(page.locator("text=Welcome back")).toBeVisible();
  });

  test("unknown route preserves path in redirect param", async ({ page }) => {
    await page.goto("/nonexistent-page");
    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain("redirect=");
  });

  test("deep unknown route redirects to login", async ({ page }) => {
    await page.goto("/some/deeply/nested/nonexistent/path");
    await page.waitForURL(/\/auth\/login/);
    await expect(page.locator("text=Welcome back")).toBeVisible();
  });
});

test.describe("Footer links", () => {
  test("footer has Privacy Policy link", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: "Privacy Policy" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/privacy");
  });

  test("footer has Terms of Service link", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: "Terms of Service" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/terms");
  });

  test("footer has Contact link", async ({ page }) => {
    await page.goto("/");
    const link = page.locator("footer").getByRole("link", { name: "Contact" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/contact");
  });

  test("footer shows copyright text", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer").getByText("TryVit", { exact: false })).toBeVisible();
  });

  test("Privacy Policy link navigates correctly", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Privacy Policy" }).click();
    await page.waitForURL(/\/privacy/);
    await expect(page).toHaveURL("/privacy");
  });

  test("Terms of Service link navigates correctly", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Terms of Service" }).click();
    await page.waitForURL(/\/terms/);
    await expect(page).toHaveURL("/terms");
  });
});

test.describe("Backend-independent public pages", () => {
  const routes = [
    "/",
    "/contact",
    "/privacy",
    "/terms",
    "/forbidden",
    "/offline",
    "/learn",
    "/learn/allergens",
  ];

  for (const route of routes) {
    test(`${route} is reachable without an authentication redirect`, async ({ page }) => {
      const response = await page.goto(route);

      expect(response?.ok(), route).toBe(true);
      await expect(page).not.toHaveURL(/\/auth\/login/);
    });
  }
});

test.describe("Header", () => {
  test("shows TryVit logo linking to home", async ({ page }) => {
    await page.goto("/contact");
    const logo = page.getByRole("link", { name: /TryVit/ });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("href", "/");
  });

  test("has Contact nav link", async ({ page }) => {
    await page.goto("/");
    const link = page.locator("header").getByRole("link", { name: "Contact" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/contact");
  });

  test("shows the truthful demo-status action while data is paused", async ({ page }) => {
    await page.goto("/");
    const demoAction = page.locator("header").getByRole("link", { name: "Demo mode" });
    await expect(demoAction).toBeVisible();
    await expect(demoAction).toHaveAttribute("href", "#service-status");
  });

  test("logo navigates to landing from contact page", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("link", { name: /TryVit/ }).click();
    await expect(page).toHaveURL("/");
  });
});

test.describe("Landing page features", () => {
  test("hero subtitle describes the paused demo truthfully", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("The method remains available while live product data is paused", {
        exact: false,
      }),
    ).toBeVisible();
  });

  test("renders the observed evidence layer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Sugars 3.2 g and saturated fat 0.4 g per 100 ml")).toBeVisible();
  });

  test("renders the derived evidence layer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("72 / 100 provisional method output")).toBeVisible();
  });

  test("renders explicit missingness", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/processing is not assessed/i)).toBeVisible();
  });

  test("demo CTA links to the service-status explanation", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator("header").getByRole("link", { name: "Demo mode" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "#service-status");
  });
});

test.describe("Login page details", () => {
  test("shows session expired message when reason=expired", async ({ page }) => {
    await page.goto("/auth/login?reason=expired");
    await expect(page.getByText("Your session has expired", { exact: false })).toBeVisible();
  });

  test("does not show expired message without query param", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByText("Your session has expired", { exact: false })).not.toBeVisible();
  });

  test("shows subtitle text", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByText("Sign in to your TryVit account")).toBeVisible();
  });

  test("Sign In button is present", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("button", { name: /Sign In/i })).toBeVisible();
  });

  test("has Sign up link for new users", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByText("Don't have an account?", { exact: false })).toBeVisible();
  });
});

test.describe("Signup page details", () => {
  test("password field has correct placeholder", async ({ page }) => {
    await page.goto("/auth/signup");
    const passwordInput = page.getByLabel("Password", { exact: true });
    await expect(passwordInput).toHaveAttribute("placeholder", "At least 6 characters");
  });

  test("Sign Up button is present", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.getByRole("button", { name: /Sign Up/i })).toBeVisible();
  });

  test("has Sign in link for existing users", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.getByRole("link", { name: /Sign in/i })).toBeVisible();
  });
});

test.describe("Authentication entry and recovery routes", () => {
  for (const route of ["/auth/forgot-password", "/auth/update-password"]) {
    test(`${route} remains reachable while signed out`, async ({ page }) => {
      const response = await page.goto(route);

      expect(response?.ok(), route).toBe(true);
      await expect(page).not.toHaveURL(/\/auth\/login/);
    });
  }
});

test.describe("Public shared pages", () => {
  test("shared list route reaches its truthful invalid-token state without login", async ({
    page,
  }) => {
    const response = await page.goto("/lists/shared/invalid-token-abc123");

    expect(response?.ok()).toBe(true);
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });

  test("shared comparison route reaches its truthful invalid-token state without login", async ({
    page,
  }) => {
    const response = await page.goto("/compare/shared/invalid-token-xyz789");

    expect(response?.ok()).toBe(true);
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });
});

test.describe("Public system and metadata resources", () => {
  const browserResources = [
    "/manifest.webmanifest",
    "/sw.js",
    "/robots.txt",
    "/sitemap.xml",
    "/opengraph-image",
    "/twitter-image",
    "/lists/shared/invalid-token-abc123/opengraph-image",
    "/compare/shared/invalid-token-abc123/opengraph-image",
    "/icons/icon-192.png",
  ];

  for (const resource of browserResources) {
    test(`${resource} is reachable without an authentication redirect`, async ({ page }) => {
      const response = await page.goto(resource);

      expect(response?.ok(), resource).toBe(true);
      await expect(page).not.toHaveURL(/\/auth\/login/);
    });
  }

  test("/favicon.ico is reachable without an authentication redirect", async ({ page }) => {
    const response = await page.request.get("/favicon.ico", { maxRedirects: 0 });

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toMatch(/^image\/x-icon/i);
  });
});

test.describe("Auth redirect preserves intended URL", () => {
  test("visiting /app/lists redirects to login", async ({ page }) => {
    await page.goto("/app/lists");
    await page.waitForURL(/\/auth\/login/);
    await expect(page.locator("text=Welcome back")).toBeVisible();
  });

  test("visiting /app/scan redirects to login", async ({ page }) => {
    await page.goto("/app/compare");
    await page.waitForURL(/\/auth\/login/);
  });

  test("visiting an admin route redirects to login while signed out", async ({ page }) => {
    await page.goto("/app/admin/monitoring");
    await page.waitForURL(/\/auth\/login/);
  });
});

test.describe("Page meta and SEO basics", () => {
  test("landing page has viewport meta tag", async ({ page }) => {
    await page.goto("/");
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute("content", /width/);
  });

  test("contact page has correct title", async ({ page }) => {
    await page.goto("/contact");
    await expect(page).toHaveTitle(/TryVit/);
  });

  test("privacy page has correct title", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).toHaveTitle(/TryVit/);
  });

  test("login page has correct title", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).toHaveTitle(/TryVit/);
  });
});
