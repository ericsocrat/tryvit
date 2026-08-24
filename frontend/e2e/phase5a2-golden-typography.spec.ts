import { writeFileSync } from "node:fs";

import { expect, test } from "./fixtures/safe-test";
import { goldenOutputPath } from "./helpers/phase5a2-golden-reference";

import { GOLDEN_FONT_ASSAY, GOLDEN_TYPE_SCALE } from "@/app/dev/phase5a2/_golden/font-assay";

type ShiftWindow = Window & {
  __goldenTypographyCls?: number;
};

test("retains exact font transfer, coverage, tabular figures and fallback CLS", async ({ page }) => {
  test.setTimeout(120_000);
  let releaseFonts: (() => void) | undefined;
  const fontGate = new Promise<void>((resolve) => {
    releaseFonts = resolve;
  });
  const requestedFonts: string[] = [];

  await page.addInitScript(() => {
    const state = window as ShiftWindow;
    state.__goldenTypographyCls = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          readonly hadRecentInput?: boolean;
          readonly value?: number;
        };
        if (!shift.hadRecentInput) state.__goldenTypographyCls += shift.value ?? 0;
      }
    });
    observer.observe({ type: "layout-shift", buffered: true });
  });
  await page.route(/\.woff2(?:\?.*)?$/u, async (route) => {
    requestedFonts.push(new URL(route.request().url()).pathname);
    await fontGate;
    await route.continue();
  });

  const navigation = page.goto("/dev/phase5a2/golden-assets/typography?theme=light", {
    waitUntil: "domcontentloaded",
  });
  const board = page.locator("[data-golden-asset-board='typography']");
  await board.waitFor({ state: "attached" });
  await expect.poll(() => requestedFonts.length).toBe(GOLDEN_FONT_ASSAY.files.length);

  const before = await page.locator("[data-golden-type-specimen^='candidate-'] [data-golden-type-copy]")
    .evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    }));
  await page.evaluate(() => {
    (window as ShiftWindow).__goldenTypographyCls = 0;
  });

  releaseFonts?.();
  await navigation;
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  const result = await page.evaluate(({ proof, expectedBytes, typeScale }) => {
    const after = [...document.querySelectorAll<HTMLElement>(
      "[data-golden-type-specimen^='candidate-'] [data-golden-type-copy]",
    )].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        height: rect.height,
        fontFamily: getComputedStyle(element).fontFamily,
      };
    });
    const fontResources = performance.getEntriesByType("resource")
      .filter((entry) => entry.name.includes(".woff2"))
      .map((entry) => {
        const resource = entry as PerformanceResourceTiming;
        return {
          path: new URL(resource.name).pathname,
          encodedBodySize: resource.encodedBodySize,
        };
      })
      .sort((left, right) => left.path.localeCompare(right.path, "en"));
    const digitProbe = document.createElement("div");
    Object.assign(digitProbe.style, {
      position: "fixed",
      inset: "-10000px auto auto -10000px",
      fontFamily: '"Golden Manrope Assay"',
      fontFeatureSettings: '"tnum" 1',
      fontVariantNumeric: "tabular-nums",
      fontSize: `${typeScale.tabular}px`,
      whiteSpace: "nowrap",
    });
    const digitWidths = [..."0123456789"].map((digit) => {
      const span = document.createElement("span");
      span.textContent = digit;
      span.style.display = "inline-block";
      digitProbe.append(span);
      return span;
    });
    document.body.append(digitProbe);
    const measuredDigitWidths = digitWidths.map((span) => span.getBoundingClientRect().width);
    digitProbe.remove();
    return {
      after,
      cls: (window as ShiftWindow).__goldenTypographyCls ?? 0,
      fontResources,
      transferredBytes: fontResources.reduce((sum, font) => sum + font.encodedBodySize, 0),
      expectedBytes,
      coverage: {
        manropeEnglish: document.fonts.check(`${typeScale.display}px "Golden Manrope Assay"`, proof.english),
        manropePolish: document.fonts.check(`${typeScale.polish}px "Golden Manrope Assay"`, proof.polish),
        manropeGerman: document.fonts.check(`${typeScale.german}px "Golden Manrope Assay"`, proof.german),
        serifPolish: document.fonts.check(`${typeScale.polish}px "Golden Assay Serif"`, proof.polish),
        serifGerman: document.fonts.check(`${typeScale.german}px "Golden Assay Serif"`, proof.german),
      },
      digitWidthRange: Math.max(...measuredDigitWidths) - Math.min(...measuredDigitWidths),
    };
  }, {
    proof: GOLDEN_FONT_ASSAY.proof,
    expectedBytes: GOLDEN_FONT_ASSAY.transferBytes,
    typeScale: GOLDEN_TYPE_SCALE,
  });

  const geometryDelta = result.after.map((current, index) => ({
    top: Math.abs(current.top - (before[index]?.top ?? Number.POSITIVE_INFINITY)),
    height: Math.abs(current.height - (before[index]?.height ?? Number.POSITIVE_INFINITY)),
  }));
  expect(Object.values(result.coverage).every(Boolean)).toBe(true);
  expect(result.fontResources).toHaveLength(GOLDEN_FONT_ASSAY.files.length);
  expect(result.transferredBytes).toBe(result.expectedBytes);
  expect(result.digitWidthRange).toBeLessThanOrEqual(0.05);
  expect(result.cls).toBeLessThanOrEqual(0.01);
  expect(Math.max(...geometryDelta.map(({ top }) => top))).toBeLessThanOrEqual(1);
  expect(Math.max(...geometryDelta.map(({ height }) => height))).toBeLessThanOrEqual(1);
  expect(result.after[0]?.fontFamily).toContain("Golden Manrope Assay");
  expect(result.after[1]?.fontFamily).toContain("Golden Assay Serif");
  expect(result.after[2]?.fontFamily).toContain("Golden Assay Serif");
  expect(result.after[3]?.fontFamily).toContain("Golden Manrope Assay");

  const sourceSha = process.env.PHASE5A2_GOLDEN_SOURCE_SHA ?? "";
  const sourceTreeSha = process.env.PHASE5A2_GOLDEN_SOURCE_TREE_SHA ?? "";
  expect(sourceSha).toMatch(/^[0-9a-f]{40}$/u);
  expect(sourceTreeSha).toMatch(/^[0-9a-f]{40}$/u);
  writeFileSync(
    goldenOutputPath("font-assay.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      kind: "phase5a2-golden-font-assay",
      sourceSha,
      sourceTreeSha,
      reviewOnly: true,
      productionAdoption: false,
      status: GOLDEN_FONT_ASSAY.status,
      transferLimitBytes: GOLDEN_FONT_ASSAY.transferLimitBytes,
      transferredBytes: result.transferredBytes,
      fontResources: result.fontResources,
      unicodeCoverage: GOLDEN_FONT_ASSAY.unicodeCoverage,
      proof: GOLDEN_FONT_ASSAY.proof,
      coverage: result.coverage,
      tabularDigitWidthRangePx: result.digitWidthRange,
      fallbackMetrics: GOLDEN_FONT_ASSAY.fallbackMetrics,
      fallbackCls: result.cls,
      fallbackGeometryDeltaPx: geometryDelta,
      files: GOLDEN_FONT_ASSAY.files,
      sources: GOLDEN_FONT_ASSAY.sources,
      subsetting: GOLDEN_FONT_ASSAY.subsetting,
    }, null, 2)}\n`,
    "utf8",
  );
});
