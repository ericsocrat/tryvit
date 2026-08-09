import { mkdirSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";

import { expect, test, type Page } from "./fixtures/safe-test";
// Node's type-stripping loader requires the source extension at runtime.
// @ts-expect-error TS5097: executed through the guarded Playwright launcher.
import {
  CATALOG_CAPTURE_CONTEXTS,
  CATALOG_CAPTURE_VIEWPORTS,
  CATALOG_SCENE_IDS,
} from "@/../tooling/design-system/catalog/capture-contract.ts";

const CATALOG_PATH = "/dev/components";
const FIXED_TIME = new Date("2026-01-01T12:00:00.000Z");

test.use({ serviceWorkers: "block" });
test.describe.configure({ mode: "serial", retries: 0 });

async function settleCatalog(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("[data-catalog-scene]").first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function assertCatalogHealth(page: Page, errors: readonly string[]): Promise<void> {
  const widths = await page.locator("[data-catalog-scene]").evaluateAll((scenes) =>
    scenes.map((scene) => ({ width: scene.scrollWidth, viewport: window.innerWidth })),
  );
  expect(widths.every(({ width, viewport }) => width <= viewport)).toBe(true);
  expect(errors).toEqual([]);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
}

async function writeContactSheet(buffers: readonly Buffer[], destination: string): Promise<void> {
  const cellWidth = 360;
  const cellHeight = 240;
  const cells = await Promise.all(
    buffers.map((buffer) =>
      sharp(buffer)
        .resize({ width: cellWidth, height: cellHeight, fit: "contain", background: "#ffffff" })
        .png()
        .toBuffer(),
    ),
  );
  await sharp({
    create: { width: cellWidth * 2, height: cellHeight * 2, channels: 4, background: "#ffffff" },
  })
    .composite(cells.map((input, index) => ({ input, left: (index % 2) * cellWidth, top: Math.floor(index / 2) * cellHeight })))
    .png()
    .toFile(destination);
}

for (const viewport of CATALOG_CAPTURE_VIEWPORTS) {
  for (const context of CATALOG_CAPTURE_CONTEXTS) {
    test(`${context.id} ${viewport.width}x${viewport.height}: captures four deterministic scenes`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", () => errors.push("pageerror"));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push("console-error");
      });
      await page.setViewportSize(viewport);
      await page.clock.setFixedTime(FIXED_TIME);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), context.colorScheme);
      await page.emulateMedia({
        colorScheme: context.colorScheme,
        reducedMotion: context.reducedMotion,
        forcedColors: context.forcedColors,
      });
      await page.setExtraHTTPHeaders({ "Accept-Language": context.locale });
      await page.goto(CATALOG_PATH);
      await settleCatalog(page);
      await expect(page.locator("[data-testid='living-label-v2-foundation']")).toBeVisible();
      await expect(page.locator("[data-testid='living-label-v2-evidence']")).toBeVisible();
      await assertCatalogHealth(page, errors);

      const candidateDirectory = testInfo.outputPath(
        "phase5a1-catalog-candidates",
        `${context.id}-${viewport.width}x${viewport.height}`,
      );
      mkdirSync(candidateDirectory, { recursive: true });
      const buffers: Buffer[] = [];
      for (const scene of CATALOG_SCENE_IDS) {
        const destination = path.join(candidateDirectory, `${scene}.png`);
        buffers.push(await page.locator(`[data-catalog-scene='${scene}']`).screenshot({ path: destination, animations: "disabled" }));
      }
      await writeContactSheet(buffers, path.join(candidateDirectory, "contact-sheet.png"));
    });
  }
}
