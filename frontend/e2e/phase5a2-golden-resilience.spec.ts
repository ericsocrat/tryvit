import { writeFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/safe-test";

import {
  GOLDEN_FORCED_COLORS_STILLS,
  GOLDEN_POLISH_MOBILE_STILLS,
  GOLDEN_REFERENCE_IDS,
  GOLDEN_STATE_CAPTURES,
  defaultGoldenState,
} from "@/../tooling/design-system/golden-reference/capture-contract";
import { goldenOutputPath, openGoldenBoard } from "./helpers/phase5a2-golden-reference";

type TypographyGeometry = {
  readonly boardOverflow: number;
  readonly documentOverflow: number;
  readonly viewportOverflow: number;
  readonly minimumMetadataSize: number;
  readonly specimens: readonly {
    readonly id: string;
    readonly label: string;
    readonly labeledSize: number | null;
    readonly computedSize: number;
    readonly contained: boolean;
    readonly clipped: boolean;
    readonly labelOverlap: boolean;
  }[];
  readonly siblingOverlaps: readonly string[];
};

const textSpacingEvidence: Array<Readonly<{
  reference: string;
  locale: "pl";
  documentOverflow: number;
  rootOverflow: number;
  offenderCount: number;
  edgeRects: readonly Readonly<{
    tag: string;
    className: string;
    text?: string;
    left: number;
    right: number;
    width: number;
    containedByHorizontalScroller: boolean;
    scrollerTag?: string;
    scrollerRole?: string;
  }>[];
}>> = [];
const reflowEvidence: Array<Readonly<{
  reference: string;
  locale: "en";
  viewport: Readonly<{ width: 384; height: 844 }>;
  overflow: number;
}>> = [];
const typographyGeometryEvidence: Array<Readonly<{
  scenario: string;
  documentOverflow: number;
  siblingOverlapCount: number;
  clippedCount: number;
  minimumMetadataSize: number;
  computedSizes: readonly number[];
}>> = [];
const identitySemanticsEvidence: Array<Readonly<{
  board: string;
  totalMarks: number;
  labeledMarks: number;
  decorativeMarks: number;
  invalidMarks: number;
  labeledWordmarks: number;
}>> = [];
const liveIdentitySemanticsEvidence: Array<Readonly<{
  reference: string;
  ownerLockups: number;
  totalMarks: number;
  invalidMarks: number;
  totalGlyphs: number;
  invalidGlyphs: number;
  labeledWordmarks: number;
  productRecordMasterMarks: number;
  ownerBoundaryViolations: number;
}>> = [];

async function readTypographyGeometry(page: Page): Promise<TypographyGeometry> {
  return page.locator("[data-golden-asset-board='typography']").evaluate((board) => {
    const tolerance = 1;
    const articles = [...board.querySelectorAll<HTMLElement>("[data-golden-type-specimen]")];
    const rectangles = articles.map((article) => ({
      article,
      rect: article.getBoundingClientRect(),
    }));
    const siblingOverlaps: string[] = [];
    for (let leftIndex = 0; leftIndex < rectangles.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < rectangles.length; rightIndex += 1) {
        const left = rectangles[leftIndex];
        const right = rectangles[rightIndex];
        if (!left || !right) continue;
        const overlapWidth = Math.min(left.rect.right, right.rect.right)
          - Math.max(left.rect.left, right.rect.left);
        const overlapHeight = Math.min(left.rect.bottom, right.rect.bottom)
          - Math.max(left.rect.top, right.rect.top);
        if (overlapWidth > tolerance && overlapHeight > tolerance) {
          siblingOverlaps.push(
            `${left.article.dataset.goldenTypeSpecimen}:${right.article.dataset.goldenTypeSpecimen}`,
          );
        }
      }
    }
    return {
      boardOverflow: Math.max(
        board.scrollWidth - board.clientWidth,
        board.scrollHeight - board.clientHeight,
      ),
      documentOverflow: document.documentElement.scrollWidth
        - document.documentElement.clientWidth,
      viewportOverflow: board.getBoundingClientRect().bottom - innerHeight,
      minimumMetadataSize: Math.min(...[
        ...board.querySelectorAll<HTMLElement>(
          "[data-golden-type-column] header p, [data-golden-type-column] header small, [data-golden-type-label]",
        ),
      ].map((element) => Number.parseFloat(getComputedStyle(element).fontSize))),
      specimens: rectangles.map(({ article, rect }) => {
        const label = article.querySelector<HTMLElement>("[data-golden-type-label]");
        const specimen = article.querySelector<HTMLElement>("[data-golden-type-copy]");
        if (!label || !specimen) {
          return {
            id: article.dataset.goldenTypeSpecimen ?? "missing",
            label: "",
            labeledSize: null,
            computedSize: 0,
            contained: false,
            clipped: true,
            labelOverlap: true,
          };
        }
        const labelText = label.textContent?.trim() ?? "";
        const labeledSize = Number(labelText.match(/\/\s*(\d+(?:\.\d+)?)\s*$/u)?.[1] ?? NaN);
        const labelRect = label.getBoundingClientRect();
        const specimenRect = specimen.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(specimen);
        const textRect = range.getBoundingClientRect();
        const specimenStyle = getComputedStyle(specimen);
        return {
          id: article.dataset.goldenTypeSpecimen ?? "missing",
          label: labelText,
          labeledSize: Number.isFinite(labeledSize) ? labeledSize : null,
          computedSize: Number.parseFloat(getComputedStyle(specimen).fontSize),
          contained:
            labelRect.left >= rect.left - tolerance
            && labelRect.right <= rect.right + tolerance
            && labelRect.top >= rect.top - tolerance
            && specimenRect.left >= rect.left - tolerance
            && specimenRect.right <= rect.right + tolerance
            && specimenRect.bottom <= rect.bottom + tolerance
            && textRect.left >= rect.left - tolerance
            && textRect.right <= rect.right + tolerance
            && textRect.top >= rect.top - tolerance
            && textRect.bottom <= rect.bottom + tolerance,
          clipped:
            (["hidden", "clip"].includes(specimenStyle.overflowX)
              && specimen.scrollWidth > specimen.clientWidth + tolerance)
            || (["hidden", "clip"].includes(specimenStyle.overflowY)
              && specimen.scrollHeight > specimen.clientHeight + tolerance),
          labelOverlap:
            Math.min(labelRect.right, specimenRect.right)
              - Math.max(labelRect.left, specimenRect.left) > tolerance
            && Math.min(labelRect.bottom, specimenRect.bottom)
              - Math.max(labelRect.top, specimenRect.top) > tolerance,
        };
      }),
      siblingOverlaps,
    };
  });
}

function routeFor(
  reference: (typeof GOLDEN_REFERENCE_IDS)[number],
  state: string,
  locale: "en" | "pl" | "de" = "en",
  theme: "light" | "dark" = reference === "scanner" ? "dark" : "light",
): string {
  return `/dev/phase5a2/golden/${reference}?locale=${locale}&theme=${theme}&motion=reduced&state=${state}`;
}

async function admit(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-golden-ready='true']")).toBeVisible();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-golden-client]")].every(
      (element) => element.getAttribute("data-golden-client-ready") === "true",
    ),
  );
}

for (const capture of GOLDEN_STATE_CAPTURES) {
  test(`whole-page Axe · ${capture.reference} · ${capture.state}`, async ({ page }, testInfo) => {
    await admit(page, routeFor(capture.reference, capture.state));
    const results = await new AxeBuilder({ page }).analyze();
    await testInfo.attach("axe-results", {
      body: Buffer.from(JSON.stringify({
        reference: capture.reference,
        state: capture.state,
        violations: results.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.length,
        })),
      })),
      contentType: "application/json",
    });
    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}

for (const capture of GOLDEN_POLISH_MOBILE_STILLS) {
  test(`text spacing · ${capture.reference}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await admit(
      page,
      routeFor(capture.reference, defaultGoldenState(capture.reference), "pl", "light"),
    );
    await page.addStyleTag({
      content: `
        [data-golden-reference], [data-golden-reference] *, [data-ds-portal-root], [data-ds-portal-root] * {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
        [data-golden-reference] p, [data-ds-portal-root] p { margin-bottom: 2em !important; }
      `,
    });
    const geometry = await page.locator("[data-golden-reference]").evaluate((root) => ({
      rootOverflow: root.scrollWidth - root.clientWidth,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      offenders: [...root.querySelectorAll<HTMLElement>("*")]
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1))
        .slice(0, 20)
        .map(({ element, rect }) => {
          let scroller: HTMLElement | null = element.parentElement;
          while (scroller && scroller !== root) {
            const overflowX = getComputedStyle(scroller).overflowX;
            if (
              ["auto", "scroll"].includes(overflowX) &&
              scroller.scrollWidth > scroller.clientWidth + 1
            ) break;
            scroller = scroller.parentElement;
          }
          const containedByHorizontalScroller = Boolean(scroller && scroller !== root);
          return {
            tag: element.tagName.toLowerCase(),
            className: element.className,
            text: element.textContent?.trim().slice(0, 80),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            containedByHorizontalScroller,
            scrollerTag: containedByHorizontalScroller ? scroller?.tagName.toLowerCase() : undefined,
            scrollerRole: containedByHorizontalScroller ? scroller?.getAttribute("role") ?? undefined : undefined,
          };
        }),
    }));
    textSpacingEvidence.push({
      reference: capture.reference,
      locale: "pl",
      documentOverflow: geometry.documentOverflow,
      rootOverflow: geometry.rootOverflow,
      offenderCount: geometry.offenders.length,
      edgeRects: geometry.offenders,
    });
    expect(geometry.documentOverflow, JSON.stringify(geometry.offenders, null, 2)).toBeLessThanOrEqual(1);
    expect(
      geometry.offenders.filter(({ containedByHorizontalScroller }) =>
        !containedByHorizontalScroller,
      ),
    ).toEqual([]);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

for (const reference of GOLDEN_REFERENCE_IDS) {
  test(`200-percent equivalent reflow · ${reference}`, async ({ page }) => {
    await page.setViewportSize({ width: 384, height: 844 });
    await admit(page, routeFor(reference, defaultGoldenState(reference)));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    reflowEvidence.push({
      reference,
      locale: "en",
      viewport: { width: 384, height: 844 },
      overflow,
    });
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

for (const capture of GOLDEN_FORCED_COLORS_STILLS) {
  test(`forced colors · ${capture.reference} · ${capture.state}`, async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await admit(page, routeFor(capture.reference, capture.state));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const semantics = await page.locator("[data-golden-reference]").evaluate((root) => ({
      state: root.getAttribute("data-golden-state"),
      text: root.textContent?.trim().length ?? 0,
      borders: [...root.querySelectorAll("button, a, input")].filter((element) => {
        const style = getComputedStyle(element);
        return style.outlineStyle !== "none" || style.borderStyle !== "none";
      }).length,
    }));
    expect(semantics.state).toBe(capture.state);
    expect(semantics.text).toBeGreaterThan(100);
    expect(semantics.borders).toBeGreaterThan(0);
    if (capture.reference === "landing" || capture.reference === "home") {
      const essential = capture.reference === "landing"
        ? page.getByRole("link", { name: "Explore the evidence" })
        : page.getByRole("link", { name: "Home", exact: true });
      const forcedStyle = await essential.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          color: style.color,
          forcedColorAdjust: style.forcedColorAdjust,
          label: element.textContent?.trim(),
        };
      });
      expect(forcedStyle.label).toBe(capture.reference === "landing" ? "Explore the evidence" : "Home");
      expect(forcedStyle.forcedColorAdjust).toBe("none");
      expect(forcedStyle.color).not.toBe(forcedStyle.background);
    }
  });
}

test("RTL-sensitive Product Tabs and portal ownership inherit direction", async ({ page }) => {
  await admit(page, routeFor("product", "unknown"));
  await page.locator("[data-golden-reference]").evaluate((root) => {
    root.setAttribute("dir", "rtl");
  });
  const nutrition = page.getByRole("tab", { name: "Nutrition" });
  const ingredients = page.getByRole("tab", { name: "Ingredients" });
  await nutrition.focus();
  await nutrition.press("ArrowLeft");
  await expect(ingredients).toBeFocused();
  await page.getByRole("button", { name: "Open provenance" }).click();
  const dialog = page.getByRole("dialog", { name: "Source and method provenance" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.closest("[data-ds-portal-root]")?.getAttribute("dir"))).toBe("rtl");
});

for (const theme of ["light", "dark"] as const) {
  test(`typography board has truthful, contained, non-overlapping scale · ${theme}`, async ({ page }) => {
    await openGoldenBoard(page, "typography", theme);
    const geometry = await readTypographyGeometry(page);
    typographyGeometryEvidence.push({
      scenario: `default-${theme}`,
      documentOverflow: geometry.documentOverflow,
      siblingOverlapCount: geometry.siblingOverlaps.length,
      clippedCount: geometry.specimens.filter(({ clipped, contained, labelOverlap }) =>
        clipped || !contained || labelOverlap,
      ).length,
      minimumMetadataSize: geometry.minimumMetadataSize,
      computedSizes: geometry.specimens.map(({ computedSize }) => computedSize),
    });
    expect(geometry.specimens).toHaveLength(8);
    expect(geometry.minimumMetadataSize).toBeGreaterThanOrEqual(12);
    expect(new Set(geometry.specimens.map(({ computedSize }) => computedSize)).size).toBe(4);
    for (const specimen of geometry.specimens) {
      expect(specimen.labeledSize, specimen.label).not.toBeNull();
      expect(specimen.computedSize, specimen.label).toBe(specimen.labeledSize);
      expect(specimen.contained, specimen.id).toBe(true);
      expect(specimen.clipped, specimen.id).toBe(false);
      expect(specimen.labelOverlap, specimen.id).toBe(false);
    }
    expect(geometry.siblingOverlaps).toEqual([]);
    expect(geometry.boardOverflow).toBeLessThanOrEqual(1);
    expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
    expect(geometry.viewportOverflow).toBeLessThanOrEqual(1);
    await expect(page.locator(
      '[data-golden-type-copy][aria-label="Wiarygodność danych nie ukrywa brakujących informacji."]',
    )).toHaveCount(2);
    await expect(page.locator(
      '[data-golden-type-copy][aria-label="Verpackungsangaben, abgeleitete Einordnung und Datenverlässlichkeit bleiben unterscheidbar."]',
    )).toHaveCount(2);
  });
}

test("typography board survives 200-percent equivalent reflow", async ({ page }) => {
  await openGoldenBoard(page, "typography");
  await page.setViewportSize({ width: 720, height: 450 });
  const geometry = await readTypographyGeometry(page);
  typographyGeometryEvidence.push({
    scenario: "200-percent-equivalent-reflow",
    documentOverflow: geometry.documentOverflow,
    siblingOverlapCount: geometry.siblingOverlaps.length,
    clippedCount: geometry.specimens.filter(({ clipped, contained, labelOverlap }) =>
      clipped || !contained || labelOverlap,
    ).length,
    minimumMetadataSize: geometry.minimumMetadataSize,
    computedSizes: geometry.specimens.map(({ computedSize }) => computedSize),
  });
  expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
  expect(geometry.siblingOverlaps).toEqual([]);
  for (const specimen of geometry.specimens) {
    expect(specimen.contained, specimen.id).toBe(true);
    expect(specimen.clipped, specimen.id).toBe(false);
    expect(specimen.labelOverlap, specimen.id).toBe(false);
  }
});

test("typography board preserves every proof under WCAG text spacing", async ({ page }) => {
  await openGoldenBoard(page, "typography");
  await page.addStyleTag({
    content: `
      [data-golden-asset-board='typography'],
      [data-golden-asset-board='typography'] * {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
    `,
  });
  const geometry = await readTypographyGeometry(page);
  typographyGeometryEvidence.push({
    scenario: "wcag-text-spacing",
    documentOverflow: geometry.documentOverflow,
    siblingOverlapCount: geometry.siblingOverlaps.length,
    clippedCount: geometry.specimens.filter(({ clipped, contained, labelOverlap }) =>
      clipped || !contained || labelOverlap,
    ).length,
    minimumMetadataSize: geometry.minimumMetadataSize,
    computedSizes: geometry.specimens.map(({ computedSize }) => computedSize),
  });
  expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
  expect(geometry.siblingOverlaps).toEqual([]);
  for (const specimen of geometry.specimens) {
    expect(specimen.contained, specimen.id).toBe(true);
    expect(specimen.clipped, specimen.id).toBe(false);
    expect(specimen.labelOverlap, specimen.id).toBe(false);
  }
});

test("identity board remains fully contained by the 1440x900 canvas", async ({ page }) => {
  await openGoldenBoard(page, "identity");
  const geometry = await page.locator("[data-golden-asset-board='identity']").evaluate((board) => ({
    boardBottom: board.getBoundingClientRect().bottom,
    viewportHeight: innerHeight,
    articleBottoms: [...board.querySelectorAll("article")].map(
      (article) => article.getBoundingClientRect().bottom,
    ),
  }));
  expect(geometry.boardBottom).toBeLessThanOrEqual(geometry.viewportHeight);
  expect(Math.max(...geometry.articleBottoms)).toBeLessThanOrEqual(geometry.viewportHeight - 1);
  for (const boardName of ["identity", "lockups"] as const) {
    await openGoldenBoard(page, boardName);
    const semantics = await page.locator(`[data-golden-asset-board='${boardName}']`).evaluate((board) => {
      const marks = [...board.querySelectorAll<SVGElement>("svg[data-golden-mark]")];
      const labeledMarks = marks.filter((mark) =>
        mark.getAttribute("role") === "img" && Boolean(mark.getAttribute("aria-label")?.trim()),
      ).length;
      const decorativeMarks = marks.filter((mark) => mark.getAttribute("aria-hidden") === "true").length;
      const wordmarks = [...board.querySelectorAll<SVGElement>("svg[data-golden-wordmark]")];
      return {
        totalMarks: marks.length,
        labeledMarks,
        decorativeMarks,
        invalidMarks: marks.length - labeledMarks - decorativeMarks,
        labeledWordmarks: wordmarks.filter((wordmark) =>
          wordmark.getAttribute("role") === "img" && Boolean(wordmark.getAttribute("aria-label")?.trim()),
        ).length,
      };
    });
    identitySemanticsEvidence.push({ board: boardName, ...semantics });
    expect(semantics.invalidMarks, boardName).toBe(0);
    if (boardName === "identity") expect(semantics.labeledMarks).toBeGreaterThan(0);
    if (boardName === "lockups") {
      expect(semantics.decorativeMarks).toBeGreaterThan(0);
      expect(semantics.labeledWordmarks).toBeGreaterThan(0);
    }
  }
});

test("every live reference keeps TryVit ownership distinct from product-record glyphs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const reference of GOLDEN_REFERENCE_IDS) {
    await admit(page, routeFor(reference, defaultGoldenState(reference)));
    const semantics = await page.locator("[data-golden-reference]").evaluate((root) => {
      const marks = [...root.querySelectorAll<SVGElement>("svg[data-golden-mark]")];
      const glyphs = [...root.querySelectorAll<SVGElement>("svg[data-golden-glyph]")];
      const wordmarks = [...root.querySelectorAll<SVGElement>("svg[data-golden-wordmark]")];
      const rootRect = root.getBoundingClientRect();
      const ownerRects = [...root.querySelectorAll<HTMLElement>("[data-golden-surface-owner]")]
        .map((owner) => owner.getBoundingClientRect());
      const validGraphic = (graphic: SVGElement) =>
        graphic.getAttribute("aria-hidden") === "true" ||
        (graphic.getAttribute("role") === "img" && Boolean(graphic.getAttribute("aria-label")?.trim()));
      return {
        ownerLockups: root.querySelectorAll("[data-golden-surface-owner] [data-golden-lockup='horizontal']").length,
        totalMarks: marks.length,
        invalidMarks: marks.filter((mark) => !validGraphic(mark)).length,
        totalGlyphs: glyphs.length,
        invalidGlyphs: glyphs.filter((glyph) => !validGraphic(glyph)).length,
        labeledWordmarks: wordmarks.filter((wordmark) =>
          wordmark.getAttribute("role") === "img" && Boolean(wordmark.getAttribute("aria-label")?.trim()),
        ).length,
        productRecordMasterMarks: root.querySelectorAll("[data-golden-product-record] svg[data-golden-mark]").length,
        ownerBoundaryViolations: ownerRects.filter((rect) =>
          rect.top < -1 || rect.left < rootRect.left - 1 || rect.right > rootRect.right + 1,
        ).length,
      };
    });
    liveIdentitySemanticsEvidence.push({ reference, ...semantics });
    expect(semantics.ownerLockups, reference).toBeGreaterThanOrEqual(1);
    expect(semantics.labeledWordmarks, reference).toBeGreaterThanOrEqual(1);
    expect(semantics.invalidMarks, reference).toBe(0);
    expect(semantics.invalidGlyphs, reference).toBe(0);
    expect(semantics.productRecordMasterMarks, reference).toBe(0);
    expect(semantics.ownerBoundaryViolations, reference).toBe(0);
  }
});

test("long German landing actions remain inside the governed desktop capture", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await admit(page, routeFor("landing", "ready", "de", "dark"));
  for (const name of ["Evidenz erkunden", "Anmeldeablauf prüfen"]) {
    const geometry = await page.getByRole("link", { name, exact: true }).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight };
    });
    expect(geometry.top, name).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom, name).toBeLessThanOrEqual(geometry.viewportHeight - 1);
  }
});

for (const localization of [
  { locale: "en" as const, label: "Return to light system" },
  { locale: "de" as const, label: "Zum hellen System zurückkehren" },
]) {
  test(`landing theme action reflects the initial dark theme · ${localization.locale}`, async ({ page }) => {
    await admit(page, routeFor("landing", "ready", localization.locale, "dark"));
    const action = page.getByRole("button", { name: localization.label, exact: true });
    await expect(action).toBeVisible();
    await action.click();
    await expect(page.locator("[data-golden-reference='landing']")).toHaveAttribute("data-theme", "light");
  });
}

for (const localization of [
  { locale: "pl" as const, title: "Napój owsiany North Grain · niepełne dane · 14 lipca" },
  { locale: "de" as const, title: "North Grain Hafergetränk · teilweise Evidenz · 14. Juli" },
]) {
  test(`localized home fixture title matches Search and Product · ${localization.locale}`, async ({ page }) => {
    await admit(page, routeFor("home", "returning", localization.locale));
    await expect(page.getByText(localization.title, { exact: true })).toBeVisible();
    await expect(page.locator("[data-golden-reference='home']")).not.toContainText("North Grain Oat Drink");
  });
}

for (const localization of [
  { locale: "pl" as const, title: "Napój owsiany North Grain — rekord testowy" },
  { locale: "de" as const, title: "North Grain Hafergetränk — Prüfmuster" },
]) {
  test(`localized product fixture title is complete · ${localization.locale}`, async ({ page }) => {
    await page.setViewportSize({ width: localization.locale === "pl" ? 390 : 1440, height: 900 });
    await admit(page, routeFor("product", "available", localization.locale, localization.locale === "de" ? "dark" : "light"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(localization.title);
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("review fixture");
  });
}

test.afterAll(() => {
  const sourceSha = process.env.PHASE5A2_GOLDEN_SOURCE_SHA ?? "";
  const sourceTreeSha = process.env.PHASE5A2_GOLDEN_SOURCE_TREE_SHA ?? "";
  if (!/^[0-9a-f]{40}$/u.test(sourceSha) || !/^[0-9a-f]{40}$/u.test(sourceTreeSha)) return;
  expect(textSpacingEvidence).toHaveLength(6);
  expect(reflowEvidence).toHaveLength(6);
  expect(typographyGeometryEvidence).toHaveLength(4);
  expect(identitySemanticsEvidence).toHaveLength(2);
  expect(liveIdentitySemanticsEvidence).toHaveLength(6);
  writeFileSync(
    goldenOutputPath("resilience.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      kind: "phase5a2-golden-resilience-evidence",
      sourceSha,
      sourceTreeSha,
      reviewOnly: true,
      methodology: {
        textSpacing: "Polish 390x844 with line-height 1.5, letter-spacing 0.12em, word-spacing 0.16em, and paragraph margin 2em. edgeRects enumerates every child rectangle outside the viewport and proves each is contained by an intentional horizontal scroller while document/root overflow remains bounded.",
        reflow: "200-percent equivalent CSS viewport of 384x844 with horizontal overflow bounded to 1px.",
        typography: "Original 1440x900 light/dark geometry plus 720x450 reflow and WCAG text-spacing override.",
      },
      textSpacing: textSpacingEvidence,
      reflow: reflowEvidence,
      typography: typographyGeometryEvidence,
      identitySemantics: identitySemanticsEvidence,
      liveIdentitySemantics: liveIdentitySemanticsEvidence,
    }, null, 2)}\n`,
    "utf8",
  );
});
