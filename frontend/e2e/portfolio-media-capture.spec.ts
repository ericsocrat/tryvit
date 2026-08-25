import path from "node:path";

import { expect, test, type Page } from "./fixtures/safe-test";
import {
  comparisonRoute,
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  portfolioScreenshotPath,
  PORTFOLIO_FILENAMES,
  PORTFOLIO_OUTPUT_ENV,
  productRoute,
  readPngDimensions,
  requireRuntimeProductId,
  SCANNER_EAN,
  validatePortfolioOutputDirectory,
} from "./helpers/portfolio-media";

const repositoryRoot = path.resolve(__dirname, "../..");
const outputDirectory = validatePortfolioOutputDirectory(
  process.env[PORTFOLIO_OUTPUT_ENV],
  repositoryRoot,
);
const productId = requireRuntimeProductId(process.env.QA_PRODUCT_ID, "QA_PRODUCT_ID");
const peerProductId = requireRuntimeProductId(
  process.env.QA_PRODUCT_NO_ALT,
  "QA_PRODUCT_NO_ALT",
);
const productPath = productRoute(productId);
const comparePath = comparisonRoute(productId, peerProductId);

const PRODUCT_NAME = "QA Dairy Milk Gouda 45%";
const PEER_PRODUCT_NAME = "QA Jogurt Naturalny 0%";
const SCANNER_PRODUCT_NAME = "QA Classic Potato Chips";

async function stabilize(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  });
  await page.evaluate(async () => document.fonts.ready);
  await expect(page.locator("body")).not.toHaveAttribute("aria-busy", "true");
}

async function assertNoSensitiveOrDebugContent(page: Page): Promise<void> {
  const snapshot = await page.evaluate(() => {
    const attributes = Array.from(
      document.querySelectorAll<HTMLElement>("a, button, input, [aria-label], [title]"),
    ).flatMap((element) =>
      ["aria-label", "title", "href", "value"]
        .map((name) => element.getAttribute(name))
        .filter((value): value is string => Boolean(value)),
    );
    return `${document.body.innerText}\n${attributes.join("\n")}`;
  });

  expect(snapshot).not.toMatch(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u);
  expect(snapshot).not.toMatch(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu,
  );
  expect(snapshot).not.toMatch(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/u);
  await expect(
    page.locator(
      "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
    ),
  ).toHaveCount(0);
  await expect(page.locator("nextjs-portal")).toHaveCount(0);
}

async function captureViewport(
  page: Page,
  filename: (typeof PORTFOLIO_FILENAMES)[keyof typeof PORTFOLIO_FILENAMES],
  viewport: { width: number; height: number },
): Promise<void> {
  expect(page.viewportSize()).toEqual(viewport);
  await assertNoSensitiveOrDebugContent(page);
  const target = portfolioScreenshotPath(outputDirectory, filename);
  await page.screenshot({ path: target, fullPage: false, animations: "disabled" });
  expect(readPngDimensions(target)).toEqual(viewport);
}

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

test("captures explainable product detail with the seeded runtime ID", async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.addInitScript(() => {
    localStorage.setItem("tryvit:product-full-analysis", "true");
  });
  await page.goto(productPath);
  await expect(page).toHaveURL(new RegExp(`/app/product/${productId}$`, "u"));
  await expect(page.getByRole("heading", { level: 1, name: PRODUCT_NAME })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("tab-bar")).toBeVisible();
  const scoringTab = page.getByRole("tab", { name: /Scoring/i });
  await scoringTab.click();
  await expect(scoringTab).toHaveAttribute("aria-selected", "true");
  const breakdown = page.getByTestId("score-breakdown-panel");
  await expect(breakdown).toBeVisible();
  await breakdown.getByRole("button").click();
  await expect(breakdown.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  await expect(breakdown.locator("#score-breakdown-content")).toBeVisible({ timeout: 30_000 });
  await expect(breakdown.locator("progress").first()).toBeVisible();
  await breakdown.scrollIntoViewIfNeeded();
  await stabilize(page);

  await captureViewport(page, PORTFOLIO_FILENAMES.productDetail, DESKTOP_VIEWPORT);
});

test("captures a two-product comparison using both seeded runtime IDs", async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto(comparePath);
  await expect(page).toHaveURL(
    new RegExp(`/app/compare\\?ids=${productId},${peerProductId}$`, "u"),
  );
  const comparisonTable = page.locator("table");
  await expect(comparisonTable).toBeVisible();
  await expect(comparisonTable.getByText(PRODUCT_NAME, { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(comparisonTable.getByText(PEER_PRODUCT_NAME, { exact: true })).toBeVisible();
  await expect(comparisonTable.getByText(/Healthiest/i)).toBeVisible();
  await expect(comparisonTable.getByText(/TryVit Score/i)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Failed to load comparison/i);
  await stabilize(page);

  await captureViewport(page, PORTFOLIO_FILENAMES.comparison, DESKTOP_VIEWPORT);
});

test("captures the manual scanner result without activating a camera", async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.context().clearPermissions();
  await page.goto("/app/scan");
  await page.getByRole("button", { name: "Manual", exact: true }).click();
  const input = page.getByPlaceholder(/Enter barcode/i);
  await expect(input).toBeVisible();
  await input.fill(SCANNER_EAN);
  await page.getByRole("button", { name: /Look up/i }).click();

  await expect(page.getByText(/Product Found/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(SCANNER_PRODUCT_NAME, { exact: true })).toBeVisible();
  await expect(page.getByText("Lookup failed")).not.toBeVisible();
  await expect(page.getByRole("button", { name: /View Details/i })).toBeVisible();
  const achievementToast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: /Achievement unlocked/i });
  await achievementToast.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
  if (await achievementToast.isVisible().catch(() => false)) {
    await achievementToast.getByRole("button", { name: "Close toast" }).click();
    await expect(achievementToast).toHaveCount(0);
  }
  await expect(page.locator("[data-sonner-toast][data-visible='true']")).toHaveCount(0);
  const cameraState = await page.locator("video").evaluateAll((videos) =>
    videos.map((video) => {
      const stream = (video as HTMLVideoElement).srcObject as MediaStream | null;
      return {
        hasStream: Boolean(stream),
        liveTracks: stream?.getTracks().filter((track) => track.readyState === "live").length ?? 0,
      };
    }),
  );
  expect(cameraState.every((state) => !state.hasStream && state.liveTracks === 0)).toBe(true);
  await stabilize(page);

  await captureViewport(page, PORTFOLIO_FILENAMES.scanner, MOBILE_VIEWPORT);
});
