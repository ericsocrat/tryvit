import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "./fixtures/safe-test";
import { expectLandingPackageTextRegions } from "./helpers/landing-package-geometry";

type Theme = "light" | "dark";

interface CaptureCase {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly locale: "en-US" | "pl-PL" | "de-DE";
  readonly language: "en" | "pl" | "de";
  readonly theme: Theme;
  readonly textSpacing?: boolean;
  readonly forcedColors?: boolean;
}

const CAPTURES: readonly CaptureCase[] = [
  { name: "landing--390x844--light--en.png", width: 390, height: 844, locale: "en-US", language: "en", theme: "light" },
  { name: "landing--390x844--dark--en.png", width: 390, height: 844, locale: "en-US", language: "en", theme: "dark" },
  { name: "landing--768x1024--light--en.png", width: 768, height: 1024, locale: "en-US", language: "en", theme: "light" },
  { name: "landing--768x1024--dark--en.png", width: 768, height: 1024, locale: "en-US", language: "en", theme: "dark" },
  { name: "landing--1440x900--light--en.png", width: 1440, height: 900, locale: "en-US", language: "en", theme: "light" },
  { name: "landing--1440x900--dark--en.png", width: 1440, height: 900, locale: "en-US", language: "en", theme: "dark" },
  // A 1280 CSS-pixel desktop viewport at 200% browser zoom exposes 640 CSS pixels.
  { name: "landing--640x900--200-percent-equivalent--en.png", width: 640, height: 900, locale: "en-US", language: "en", theme: "light" },
  { name: "landing--320x900--reflow--en.png", width: 320, height: 900, locale: "en-US", language: "en", theme: "light" },
  { name: "landing--390x844--forced-colors--en.png", width: 390, height: 844, locale: "en-US", language: "en", theme: "light", forcedColors: true },
];

async function openLanding(page: Page, capture: CaptureCase): Promise<void> {
  await page.setViewportSize({ width: capture.width, height: capture.height });
  await page.addInitScript((theme: Theme) => localStorage.setItem("theme", theme), capture.theme);
  await page.emulateMedia({
    colorScheme: capture.theme,
    reducedMotion: "reduce",
    forcedColors: capture.forcedColors ? "active" : "none",
  });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveAttribute("lang", capture.language);
  await expect(page).toHaveTitle("TryVit — Food intelligence you can inspect");
  await expect(page.locator("body")).toHaveAttribute("data-provider-boundary", "landing");
  await expect(page.locator('[data-landing-shell="folded-label-register"]')).toBeVisible();
  if (capture.textSpacing) {
    await page.addStyleTag({
      content: `
        * { letter-spacing: 0.12em !important; line-height: 1.5 !important; word-spacing: 0.16em !important; }
        p { margin-bottom: 2em !important; }
      `,
    });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    capture.width,
  );
}

async function expectFullyInViewport(page: Page, selector: string): Promise<void> {
  const geometry = await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
  });
  expect(geometry.top).toBeGreaterThanOrEqual(-1);
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
}

for (const capture of CAPTURES) {
  test(`retains ${capture.name}`, async ({ page }, testInfo: TestInfo) => {
    await openLanding(page, capture);
    await expectLandingPackageTextRegions(page);
    await page.screenshot({ path: testInfo.outputPath(capture.name), animations: "disabled" });
  });
}

for (const width of [320, 390]) {
  test(`keeps every mobile destination available at ${width}px`, async ({ page }) => {
    await openLanding(page, {
      name: `mobile-navigation-${width}`,
      width,
      height: width === 320 ? 900 : 844,
      locale: "en-US",
      language: "en",
      theme: "light",
    });

    const primary = page.getByRole("navigation", { name: "Primary navigation" });
    for (const [name, href] of [
      ["Evidence", "#evidence"],
      ["Method", "#method"],
      ["Trust", "#trust"],
      ["Contact", "/contact"],
    ] as const) {
      const destination = primary.getByRole("link", { name, exact: true });
      await expect(destination).toBeVisible();
      await expect(destination).toHaveAttribute("href", href);
      expect(await destination.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(0);
    }

    const utilities = page.getByRole("navigation", {
      name: "Account, service, and display",
    });
    await expect(utilities.getByRole("link", { name: "Demo mode" })).toBeVisible();
    await expect(utilities.getByRole("button", { name: "Use dark theme" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}

for (const viewport of [
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
]) {
  test(`keeps sticky destinations below the header at ${viewport.width}px`, async ({
    page,
  }) => {
    await openLanding(page, {
      name: `sticky-destinations-${viewport.width}`,
      ...viewport,
      locale: "en-US",
      language: "en",
      theme: "light",
    });

    for (const [href, target] of [
      ["#evidence", "#evidence"],
      ["#method", "#method"],
      ["#trust", "#trust"],
      ["#service-status", "#service-status"],
    ] as const) {
      await page.locator(`header a[href="${href}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${href.replace("#", "#")}$`, "u"));
      const geometry = await page.locator(target).evaluate((element) => {
        const targetRect = element.getBoundingClientRect();
        const headerRect = document.querySelector("header")!.getBoundingClientRect();
        return { targetTop: targetRect.top, headerBottom: headerRect.bottom };
      });
      expect(geometry.targetTop + 1).toBeGreaterThanOrEqual(geometry.headerBottom);
    }
  });
}

for (const fold of [
  { width: 320, height: 900, minimumPackagePixels: 0, requireFullPackage: true },
  { width: 390, height: 844, minimumPackagePixels: 72, requireFullPackage: false },
  { width: 640, height: 900, minimumPackagePixels: 0, requireFullPackage: true },
  { width: 768, height: 1024, minimumPackagePixels: 0, requireFullPackage: true },
  { width: 1440, height: 900, minimumPackagePixels: 0, requireFullPackage: true },
] as const) {
  test(`meets the ${fold.width}x${fold.height} first-fold geometry contract`, async ({ page }) => {
    await openLanding(page, {
      name: `first-fold-${fold.width}x${fold.height}`,
      width: fold.width,
      height: fold.height,
      locale: "en-US",
      language: "en",
      theme: "light",
    });

    await expect(page.locator('[data-landing-lockup="horizontal"]')).toHaveCount(1);
    await expect(page.locator("[data-landing-market-descriptor]")).toHaveCount(1);
    await expectFullyInViewport(page, "#landing-title");
    await expectFullyInViewport(
      page,
      'section[aria-labelledby="landing-title"] a[href="#evidence"]',
    );

    if (fold.width >= 768) {
      await expectFullyInViewport(
        page,
        'section[aria-labelledby="landing-title"] a[href="/contact"]',
      );
    }

    const packageGeometry = await page
      .locator("[data-landing-package-signature]")
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          visibleHeight: Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0)),
          viewportHeight: innerHeight,
        };
      });
    expect(packageGeometry.top).toBeLessThan(fold.height);
    if (fold.requireFullPackage) {
      expect(packageGeometry.top).toBeGreaterThanOrEqual(-1);
      expect(packageGeometry.bottom).toBeLessThanOrEqual(packageGeometry.viewportHeight + 1);
    } else {
      expect(packageGeometry.visibleHeight).toBeGreaterThanOrEqual(fold.minimumPackagePixels);
    }
  });
}

test("has zero backend traffic and retains the system font fallback", async ({ page }) => {
  const forbidden: string[] = [];
  const fontResponses = new Map<string, number>();
  const imageRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      /\/(?:auth|rest|realtime|storage|functions|graphql)\/v1(?:\/|$)/iu.test(url.pathname) ||
      url.pathname === "/api/flags"
    ) {
      forbidden.push(`${request.method()} ${url.pathname}`);
    }
    if (request.resourceType() === "image") imageRequests.push(url.pathname);
  });
  page.on("response", async (response) => {
    if (/\.woff2(?:\?|$)/u.test(response.url())) {
      fontResponses.set(new URL(response.url()).pathname, (await response.body()).byteLength);
    }
  });

  await openLanding(page, CAPTURES[0]);
  await page.waitForLoadState("networkidle");
  expect(forbidden).toEqual([]);
  expect(imageRequests).toEqual([]);
  expect([...fontResponses.values()]).toEqual([]);
});

test("keeps harmless query-bearing demo documents lean and backend-independent", async ({
  page,
}) => {
  const backendRequests: string[] = [];
  const hostedRequests: string[] = [];
  const speedInsightsRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      /\/(?:auth|rest|realtime|storage|functions|graphql)\/v1(?:\/|$)/iu.test(url.pathname) ||
      url.pathname === "/api/flags"
    ) {
      backendRequests.push(`${request.method()} ${url.href}`);
    }
    if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
      hostedRequests.push(`${request.method()} ${url.href}`);
    }
    if (url.pathname === "/_vercel/speed-insights/script.js") {
      speedInsightsRequests.push(`${request.method()} ${url.href}`);
    }
  });

  for (const pathname of [
    "/?utm_source=test",
    "/?utm_source=test&utm_campaign=x",
    "/?ref=newsletter",
    "/?foo=bar",
  ]) {
    const response = await page.goto(pathname);
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).toHaveAttribute("data-provider-boundary", "landing");
    await expect(page.locator('[data-landing-shell="folded-label-register"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Skip to content", exact: true })).toHaveCount(1);
    await page.waitForLoadState("networkidle");
  }

  expect(backendRequests).toEqual([]);
  expect(hostedRequests).toEqual([]);
  expect(speedInsightsRequests).toEqual([]);
});

test("keeps demo metadata and WebSite structured data aligned with visible copy", async ({
  page,
}) => {
  await openLanding(page, CAPTURES[0]);
  const description =
    "TryVit separates label facts from calculations, context, and decisions. The method remains available while live product data is paused.";
  const socialDescription =
    "TryVit’s evidence-first method remains available while live product data is paused; every example is synthetic.";

  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", description);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    socialDescription,
  );
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
    "content",
    socialDescription,
  );

  const structuredData = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) => scripts.map((script) => JSON.parse(script.textContent ?? "{}")));
  expect(structuredData).toHaveLength(1);
  expect(structuredData[0]).toMatchObject({
    "@type": "WebSite",
    inLanguage: "en",
    description,
  });
  expect(structuredData[0]).not.toHaveProperty("potentialAction");
});

test("keeps linked social and manifest surfaces truthful without first-party failures", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const firstPartyFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === "http://127.0.0.1:3000" && response.status() >= 400) {
      firstPartyFailures.push(`${response.status()} ${url.pathname}`);
    }
  });

  await openLanding(page, CAPTURES[0]);
  await page.waitForLoadState("networkidle");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/opengraph-image/iu,
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    "content",
    /\/twitter-image/iu,
  );

  for (const pathname of ["/opengraph-image", "/twitter-image"]) {
    const response = await page.request.get(pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect((await response.body()).byteLength).toBeGreaterThan(10_000);
  }
  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(JSON.stringify(manifest)).not.toMatch(
    /instantly|health score|healthy|harmful|scan, score|multi-axis/iu,
  );

  expect(consoleErrors).toEqual([]);
  expect(firstPartyFailures).toEqual([]);
});

test("does not load candidate fonts on authentication", async ({ page }) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (/\.woff2(?:\?|$)/u.test(request.url())) fontRequests.push(request.url());
  });
  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");
  expect(fontRequests).toEqual([]);
});

test("passes full-page Axe without exclusions or disabled rules", async ({ page }) => {
  await openLanding(page, CAPTURES[0]);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("retains keyboard order and visible skip navigation", async ({ page }) => {
  await openLanding(page, CAPTURES[0]);
  const skipLink = page.getByRole("link", { name: "Skip to content", exact: true });
  await expect(skipLink).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveAttribute("href", "#main-content");
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("href", "#evidence");
});

test("keeps provider ownership coherent across cold, RSC, and document navigation", async ({ page }) => {
  await page.goto("/?source=client");
  await expect(page.locator("body")).toHaveAttribute("data-provider-boundary", "landing");
  await expect(page.getByRole("link", { name: "Skip to content", exact: true })).toHaveCount(1);

  await page.goto("/contact");
  await page.getByRole("link", { name: "TryVit", exact: true }).click();
  await expect(page.locator('[data-landing-shell="folded-label-register"]')).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-provider-boundary", "application");
  await expect(page.getByRole("link", { name: "Skip to content", exact: true })).toHaveCount(1);

  const footerContact = page
    .getByRole("navigation", { name: "Footer navigation" })
    .getByRole("link", { name: "Contact", exact: true });
  await footerContact.scrollIntoViewIfNeeded();
  await Promise.all([page.waitForURL("**/contact"), footerContact.click()]);
  await expect(page.locator("body")).toHaveAttribute("data-provider-boundary", "application");
});
