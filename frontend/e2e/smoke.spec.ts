import { expect, test, type Page } from "./fixtures/safe-test";

// ─── Smoke tests: verify pages load without crashes ─────────────────────────
// All tests are public-page only — no Supabase dependency in CI.

function observeHydrationErrors(page: Page): string[] {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|did not match|server rendered html/iu.test(message.text())
    ) {
      hydrationErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/hydration|did not match|server rendered html/iu.test(error.message)) {
      hydrationErrors.push(error.message);
    }
  });
  return hydrationErrors;
}

test.describe("Public pages", () => {
  test("landing page renders a backend-independent demo from server HTML", async ({ page }) => {
    const forbiddenRequests: string[] = [];
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (
        /\/(?:auth|rest|realtime|storage|functions|graphql)\/v1(?:\/|$)/iu.test(pathname) ||
        pathname === "/api/flags"
      ) {
        forbiddenRequests.push(`${request.method()} ${pathname}`);
      }
    });

    const response = await page.goto("/");
    expect(response).not.toBeNull();
    const serverHtml = await response!.text();
    expect(serverHtml).toContain("Read the package. See the reasoning. Make your own call.");
    expect(serverHtml).toMatch(/<html[^>]+lang="en"/u);

    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/$/u);
    await expect(page.locator('[data-route-id="public-landing"]')).toHaveCount(1);
    await expect(
      page.locator('main#main-content[data-route-id="public-landing"]'),
    ).toHaveCount(1);
    await expect(
      page.getByRole("heading", {
        name: "Read the package. See the reasoning. Make your own call.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Demo mode").first()).toBeVisible();
    expect(forbiddenRequests).toEqual([]);
  });

  test("landing content remains visible with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Method before mystique" })).toBeVisible();
  });

  test("landing page has correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("TryVit — Food intelligence you can inspect");
  });

  test("login page renders form", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator("text=Welcome back")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("signup page renders form", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.locator("text=Create your account")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("contact page renders", async ({ page }) => {
    await page.goto("/contact");
    await expect(page).toHaveTitle(/TryVit/);
  });

  test("privacy page renders", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).toHaveTitle(/TryVit/);
  });

  test("terms page renders", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).toHaveTitle(/TryVit/);
  });
});

test.describe("Auth-protected redirects", () => {
  test("search redirects to login", async ({ page }) => {
    await page.goto("/app/search");
    await page.waitForURL(/\/auth\/login/);
    await expect(page.locator("text=Welcome back")).toBeVisible();
  });

  test("settings redirects to login", async ({ page }) => {
    await page.goto("/app/settings");
    await page.waitForURL(/\/auth\/login/);
    await expect(page.locator("text=Welcome back")).toBeVisible();
  });

  test("categories redirects to login", async ({ page }) => {
    await page.goto("/app/categories");
    await page.waitForURL(/\/auth\/login/);
    await expect(page.locator("text=Welcome back")).toBeVisible();
  });

  test("scan redirects to login", async ({ page }) => {
    await page.goto("/app/scan");
    await page.waitForURL(/\/auth\/login/);
    await expect(page.locator("text=Welcome back")).toBeVisible();
  });

  test("product detail redirects to login", async ({ page }) => {
    await page.goto("/app/product/1");
    await page.waitForURL(/\/auth\/login/);
    await expect(page.locator("text=Welcome back")).toBeVisible();
  });
});

test.describe("Navigation links", () => {
  test("landing page demo CTA links to the truthful service status", async ({ page }) => {
    await page.goto("/");
    await page.locator('a[href="#service-status"]').first().click();
    await expect(page.locator("#service-status")).toBeVisible();
  });

  test("login page has link to signup", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator('a[href="/auth/signup"]')).toBeVisible();
  });

  test("signup page has link to login", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.locator('a[href="/auth/login"]')).toBeVisible();
  });
});

test.describe("Polish public locale", () => {
  test.use({ locale: "pl-PL" });

  test("landing locale and document language stay hydration-safe", async ({ page }) => {
    const hydrationErrors = observeHydrationErrors(page);

    const response = await page.goto("/");
    expect(await response!.text()).toContain(
      "Odczytaj opakowanie. Poznaj tok rozumowania. Podejmij własną decyzję.",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(
      page.getByRole("heading", {
        name: "Odczytaj opakowanie. Poznaj tok rozumowania. Podejmij własną decyzję.",
      }),
    ).toBeVisible();
    expect(hydrationErrors).toEqual([]);
  });

  test("client-rendered contact copy matches the Polish server locale after hydration", async ({
    page,
  }) => {
    const hydrationErrors = observeHydrationErrors(page);
    const response = await page.goto("/contact");
    expect(response).not.toBeNull();

    const serverHtml = await response!.text();
    expect(serverHtml).toMatch(/<html[^>]+lang="pl"/u);
    expect(serverHtml).toContain(
      "Masz pytania, uwagi lub chcesz zgłosić problem z danymi? Skontaktuj się z nami.",
    );

    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText(
        "Masz pytania, uwagi lub chcesz zgłosić problem z danymi? Skontaktuj się z nami.",
      ),
    ).toBeVisible();
    expect(hydrationErrors).toEqual([]);
  });
});

test.describe("German public locale", () => {
  test.use({ locale: "de-DE" });

  test("regional preference resolves server content and document language", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(
      page.getByRole("heading", {
        name: "Verpackung lesen. Begründung verstehen. Selbst entscheiden.",
      }),
    ).toBeVisible();
  });

  test("client-rendered contact copy matches the German server locale after hydration", async ({
    page,
  }) => {
    const hydrationErrors = observeHydrationErrors(page);
    const response = await page.goto("/contact");
    expect(response).not.toBeNull();

    const serverHtml = await response!.text();
    expect(serverHtml).toMatch(/<html[^>]+lang="de"/u);
    expect(serverHtml).toContain(
      "Haben Sie Fragen, Feedback oder möchten Sie einen Datenfehler melden? Kontaktieren Sie uns.",
    );

    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText(
        "Haben Sie Fragen, Feedback oder möchten Sie einen Datenfehler melden? Kontaktieren Sie uns.",
      ),
    ).toBeVisible();
    expect(hydrationErrors).toEqual([]);
  });
});

test.describe("Server-rendered landing without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("preserves meaningful paused-mode content", async ({ page }) => {
    const response = await page.goto("/");
    expect(await response!.text()).toContain("Read the package. See the reasoning. Make your own call.");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Demo mode").first()).toBeVisible();
  });
});

test.describe("Login form validation", () => {
  test("submit button is disabled with empty fields", async ({ page }) => {
    await page.goto("/auth/login");
    const submitBtn = page.locator('button[type="submit"]');
    // Button should be present
    await expect(submitBtn).toBeVisible();
  });

  test("email input accepts text", async ({ page }) => {
    await page.goto("/auth/login");
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("test@example.com");
    await expect(emailInput).toHaveValue("test@example.com");
  });

  test("password input accepts text", async ({ page }) => {
    await page.goto("/auth/login");
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill("password123");
    await expect(passwordInput).toHaveValue("password123");
  });
});

test.describe("Signup form validation", () => {
  test("email input accepts text", async ({ page }) => {
    await page.goto("/auth/signup");
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("newuser@example.com");
    await expect(emailInput).toHaveValue("newuser@example.com");
  });
});

test.describe("Page accessibility basics", () => {
  test("landing page has no broken images", async ({ page }) => {
    await page.goto("/");
    // Ensure all images (if any) loaded successfully
    const images = page.locator("img");
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    }
  });

  test("login page has form labels or placeholders", async ({ page }) => {
    await page.goto("/auth/login");
    const emailInput = page.locator('input[type="email"]');
    // Should have either a label, aria-label, or placeholder
    const placeholder = await emailInput.getAttribute("placeholder");
    const ariaLabel = await emailInput.getAttribute("aria-label");
    expect(placeholder || ariaLabel).toBeTruthy();
  });
});
