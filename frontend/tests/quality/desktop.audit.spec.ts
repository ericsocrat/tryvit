/**
 * Quality Gate 5/9 — Desktop Audit Runner
 *
 * Playwright spec that visits every route from the route manifest at
 * a standard laptop viewport (1280 × 800) and applies the invariant
 * engine with desktop-specific checks.  Product pages cycle through
 * all tabs.
 *
 * Screenshots are saved to `qa_screenshots/latest/desktop/`.
 *
 * Run locally through the mandatory safety launcher (from `frontend/`):
 *
 *   npm run quality:smoke
 *   npm run quality:full
 *
 * Do not invoke the Playwright project directly. Local-authenticated coverage
 * requires the explicit local-authenticated launcher and a verified emulator.
 *
 * @see https://github.com/ericsocrat/tryvit/issues/176
 */

// eslint-disable-next-line no-restricted-imports -- quality contexts require the shared automatic egress guard
import { expect, test } from "../../e2e/fixtures/safe-test";
import { getRoutes } from "./routes";
import {
  setupErrorCollectors,
  assertNoErrors,
  runInvariantsForRoute,
} from "./invariants";
import { cleanScreenshotDir, takeScreenshot } from "./helpers/screenshot";
import { waitForStable } from "./helpers/network";

/* ── Config ──────────────────────────────────────────────────────────────── */

/** Audit mode: `smoke` visits ~9 routes, `full` visits all ~40. */
const MODE = (process.env.QA_MODE_LEVEL ?? "smoke") as "smoke" | "full";

/**
 * Auth-protected routes run only in the explicit local-authenticated safety
 * mode. Credential presence must never select a browser mode.
 */
const HAS_AUTH = process.env.VISUAL_SAFETY_MODE === "local-authenticated";

/* ── Setup ───────────────────────────────────────────────────────────────── */

test.beforeAll(async () => {
  await cleanScreenshotDir("desktop");
});

/* ── Route tests ─────────────────────────────────────────────────────────── */

const routes = getRoutes(MODE)
  .filter((r) => !r.mobileOnly)
  .filter((r) => HAS_AUTH || !r.requiresAuth);

for (const route of routes) {
  test(`desktop audit — ${route.label}`, async ({ page }) => {
    // ── Attach error collectors ───────────────────────────────────────────
    const collectors = setupErrorCollectors(page);

    // ── Navigate ──────────────────────────────────────────────────────────
    const response = await page.goto(route.path, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.ok() ?? false, `Navigation to ${route.path} failed`).toBe(
      true
    );
    await waitForStable(page);

    // ── Run invariant checks (desktop mode) ───────────────────────────────
    await runInvariantsForRoute(page, route.path, {
      isMobile: false,
      isProductPage: route.path.includes("/product/"),
      isRecipesPage: route.path.includes("/recipes"),
      isSettingsPage: route.path.includes("/settings"),
      isAdminPage: route.path.includes("/admin"),
    });

    // ── Screenshot: default state ─────────────────────────────────────────
    await takeScreenshot(page, "desktop", route.label);

    // ── Tab cycling for product pages ─────────────────────────────────────
    if (route.hasTabs?.length) {
      for (const tabId of route.hasTabs) {
        // Use role="tab" + aria-label to avoid strict-mode violation from
        // the dual-span pattern (mobile shortLabel + desktop label).
        const tabLocator = page
          .getByTestId("tab-bar")
          .getByRole("tab", { name: new RegExp(tabId, "i") });

        // Some tabs may not exist yet (feature in progress) — skip gracefully.
        if ((await tabLocator.count()) === 0) continue;

        await tabLocator.click();
        await waitForStable(page, 4_000);

        // Re-run invariants for the new tab content
        await runInvariantsForRoute(page, `${route.path}#tab-${tabId}`, {
          isMobile: false,
          isProductPage: true,
          isRecipesPage: false,
          isSettingsPage: false,
          isAdminPage: false,
        });

        await takeScreenshot(
          page,
          "desktop",
          `${route.label}_tab-${tabId}`
        );
      }
    }

    // ── Assert no errors accumulated ──────────────────────────────────────
    assertNoErrors(collectors, route.path);
  });
}
