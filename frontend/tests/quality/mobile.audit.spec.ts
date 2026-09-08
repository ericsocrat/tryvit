/**
 * Quality Gate 4/9 — Mobile Audit Runner
 *
 * Playwright spec that visits every route from the route manifest at
 * iPhone 14 viewport (390 × 844) and applies the invariant engine.
 * Product pages additionally exercise the keyboard source disclosure.
 *
 * Screenshots are saved to `qa_screenshots/latest/mobile/`.
 *
 * Run locally through the mandatory safety launcher (from `frontend/`):
 *
 *   npm run quality:smoke
 *   npm run quality:full
 *
 * Do not invoke the Playwright project directly. Local-authenticated coverage
 * requires the explicit local-authenticated launcher and a verified emulator.
 *
 * @see https://github.com/ericsocrat/tryvit/issues/175
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
  await cleanScreenshotDir("mobile");
});

/* ── Route tests ─────────────────────────────────────────────────────────── */

const routes = getRoutes(MODE)
  .filter((r) => !r.desktopOnly)
  .filter((r) => HAS_AUTH || !r.requiresAuth);

for (const route of routes) {
  test(`mobile audit — ${route.label}`, async ({ page }) => {
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

    // ── Run invariant checks ──────────────────────────────────────────────
    await runInvariantsForRoute(page, route.path, {
      isMobile: true,
      isProductPage: route.path.includes("/product/"),
      isRecipesPage: route.path.includes("/recipes"),
      isSettingsPage: route.path.includes("/settings"),
      isAdminPage: route.path.includes("/admin"),
    });

    // ── Screenshot: default state ─────────────────────────────────────────
    await takeScreenshot(page, "mobile", route.label);

    // Exercise the current source disclosure and rerun layout/a11y invariants.
    if (route.path.includes("/product/")) {
      const sources = page.getByTestId("product-sources");
      const summary = sources.locator("summary");
      await expect(sources).not.toHaveAttribute("open");
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(sources).toHaveAttribute("open", "");
      await runInvariantsForRoute(page, `${route.path}#sources`, {
        isMobile: true,
        isProductPage: true,
        isRecipesPage: false,
        isSettingsPage: false,
        isAdminPage: false,
      });
      await takeScreenshot(page, "mobile", `${route.label}_sources`);
      await summary.click();
      await expect(sources).not.toHaveAttribute("open");
    }

    // ── Assert no errors accumulated ──────────────────────────────────────
    assertNoErrors(collectors, route.path);
  });
}
