import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";

import { expect, test, type Page } from "./fixtures/safe-test";
// Node's type-stripping loader requires the source extension at runtime.
// @ts-expect-error TS5097: executed through the guarded Playwright launcher.
import {
  CATALOG_CANDIDATE_FILE_COUNT,
  CATALOG_CAPTURE_CASE_COUNT,
  CATALOG_CAPTURE_CONTEXTS,
  CATALOG_CAPTURE_VIEWPORTS,
  CATALOG_CONTACT_SHEET_COUNT,
  CATALOG_INTERACTION_CAPTURE_COUNT,
  CATALOG_INTERACTION_CAPTURE_IDS,
  CATALOG_MANIFEST_ENTRY_COUNT,
  CATALOG_PNG_COUNT,
  CATALOG_RESILIENCE_CAPTURE_COUNT,
  CATALOG_SCENE_CAPTURE_COUNT,
  CATALOG_SCENE_IDS,
  CATALOG_TEXT_SPACING_CAPTURE_ID,
  CATALOG_ZOOM_CAPTURE_ID,
  getCatalogCaptureCaseId,
  getCatalogExpectedEvidenceRecords,
  parseCatalogSourceStatus,
  type CatalogCaptureContext,
  type CatalogCaptureId,
  type CatalogCaptureViewport,
  type CatalogEvidence,
} from "@/../tooling/design-system/catalog/capture-contract.ts";

const CATALOG_PATH = "/dev/components";
const FIXED_TIME = new Date("2026-01-01T12:00:00.000Z");
const CANDIDATE_ROOT = path.resolve(process.cwd(), "test-results", "phase5a1-catalog-candidates");
const DIAGNOSTIC_ROOT = path.resolve(process.cwd(), "test-results", "phase5a1-catalog-diagnostics");
const CANDIDATE_CAPTURE_STYLE = 'a[href="#main-content"] { visibility: hidden !important; }';
const TEXT_SPACING_STYLE = `
  [data-design-system="v2"],
  [data-design-system="v2"] *:not(svg):not(path) {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  [data-design-system="v2"] p { margin-bottom: 2em !important; }
`;

type CatalogLocator = ReturnType<Page["locator"]>;
type CatalogFailureCapture = CatalogCaptureId | "catalog-shell";
type CatalogFailureCode =
  | "axe-violation"
  | "candidate-count-invalid"
  | "catalog-route-unavailable"
  | "console-error"
  | "focus-containment-invalid"
  | "focus-contract-invalid"
  | "focus-obscured"
  | "focus-restoration-invalid"
  | "forced-colors-contract-invalid"
  | "interaction-contract-invalid"
  | "locale-contract-invalid"
  | "motion-contract-invalid"
  | "nested-outside-cascade-invalid"
  | "overflow"
  | "pointer-contract-invalid"
  | "portal-scope-invalid"
  | "skip-link-contract-invalid"
  | "system-theme-contract-invalid"
  | "target-size-invalid"
  | "text-spacing-contract-invalid"
  | "theme-contract-invalid"
  | "unexpected"
  | "zoom-contract-invalid";

interface CatalogFailureDiagnostic {
  readonly axeRuleIds?: readonly string[];
  readonly axeRuleCount?: number;
  readonly axeNodeCount?: number;
}

class CatalogFailure extends Error {
  constructor(
    readonly code: CatalogFailureCode,
    readonly capture: CatalogFailureCapture,
    readonly diagnostic?: CatalogFailureDiagnostic,
  ) {
    super(`[PHASE5A1_CATALOG] ${code}:${capture}`);
  }
}

test.use({ serviceWorkers: "block" });
test.describe.configure({ mode: "serial", retries: 0 });

const completedCaseIds = new Set<string>();

function assertSafeOutputRoot(root: string): void {
  const expectedParent = path.resolve(process.cwd(), "test-results");
  if (path.dirname(root) !== expectedParent || !path.basename(root).startsWith("phase5a1-catalog-")) {
    throw new Error("[PHASE5A1_CATALOG] unsafe-output-root");
  }
}

function gitRevision(revision: string): string {
  const value = execFileSync("git", ["rev-parse", revision], {
    cwd: path.resolve(process.cwd(), ".."),
    encoding: "utf8",
  }).trim();
  if (!/^[0-9a-f]{40}$/u.test(value)) throw new Error("[PHASE5A1_CATALOG] source-sha-invalid");
  return value;
}

function sourceProvenance() {
  const sourceSha = gitRevision("HEAD");
  const configuredSourceSha = process.env.PHASE5A1_CATALOG_SOURCE_SHA ?? sourceSha;
  const pullRequestHeadSha = process.env.PHASE5A1_CATALOG_PR_HEAD_SHA ?? sourceSha;
  if (
    !/^[0-9a-f]{40}$/u.test(configuredSourceSha) ||
    !/^[0-9a-f]{40}$/u.test(pullRequestHeadSha) ||
    configuredSourceSha !== sourceSha
  ) {
    throw new Error("[PHASE5A1_CATALOG] source-sha-mismatch");
  }
  const sourceStatus = parseCatalogSourceStatus(execFileSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=normal"],
    { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8" },
  ));
  if (process.env.CI && sourceStatus.state === "dirty-development-worktree") {
    throw new Error("[PHASE5A1_CATALOG] source-worktree-dirty");
  }
  const workingTreeDiff = execFileSync("git", ["diff", "--binary", "--no-ext-diff"], {
    cwd: path.resolve(process.cwd(), ".."),
    encoding: "utf8",
  });
  return {
    sourceSha,
    sourceTreeSha: gitRevision("HEAD^{tree}"),
    pullRequestHeadSha,
    sourceState: sourceStatus.state,
    sourceWorktreeSha: createHash("sha256")
      .update(`${sourceStatus.status}\0${workingTreeDiff}`, "utf8")
      .digest("hex"),
  } as const;
}

function listFiles(root: string): string[] {
  if (!statSync(root).isDirectory()) throw new Error("[PHASE5A1_CATALOG] candidate-root-invalid");
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(root, entry.name);
      return entry.isDirectory() ? listFiles(absolute) : [absolute];
    })
    .sort((left, right) => (left === right ? 0 : left < right ? -1 : 1));
}

test.beforeAll(() => {
  for (const root of [CANDIDATE_ROOT, DIAGNOSTIC_ROOT]) {
    assertSafeOutputRoot(root);
    rmSync(root, { recursive: true, force: true });
  }
  mkdirSync(CANDIDATE_ROOT, { recursive: true });
  mkdirSync(DIAGNOSTIC_ROOT, { recursive: true });
});

test.afterAll(() => {
  if (
    completedCaseIds.size !== CATALOG_CAPTURE_CASE_COUNT ||
    getCatalogExpectedEvidenceRecords().some(({ id }) => !completedCaseIds.has(id))
  ) {
    return;
  }

  const provenance = sourceProvenance();
  const evidence: CatalogEvidence = {
    schemaVersion: 1,
    kind: "phase5a1b-canonical-primitives-interaction-evidence",
    sourceSha: provenance.sourceSha,
    sourceTreeSha: provenance.sourceTreeSha,
    pullRequestHeadSha: provenance.pullRequestHeadSha,
    records: getCatalogExpectedEvidenceRecords(),
  };
  writeFileSync(
    path.join(CANDIDATE_ROOT, "evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  const candidateFiles = listFiles(CANDIDATE_ROOT);
  const pngFiles = candidateFiles.filter((filename) => filename.endsWith(".png"));
  const contactSheets = pngFiles.filter((filename) => path.basename(filename).includes("contact-sheet"));
  const sceneCaptures = pngFiles.filter((filename) => {
    const basename = path.basename(filename, ".png");
    return CATALOG_SCENE_IDS.some((scene) => scene === basename);
  });
  const interactionCaptures = pngFiles.filter((filename) =>
    CATALOG_INTERACTION_CAPTURE_IDS.some(
      (capture) => path.basename(filename, ".png") === capture,
    ),
  );
  const resilienceCaptures = pngFiles.filter((filename) => {
    const basename = path.basename(filename, ".png");
    return basename === CATALOG_TEXT_SPACING_CAPTURE_ID || basename === CATALOG_ZOOM_CAPTURE_ID;
  });
  if (
    pngFiles.length !== CATALOG_PNG_COUNT ||
    sceneCaptures.length !== CATALOG_SCENE_CAPTURE_COUNT ||
    interactionCaptures.length !== CATALOG_INTERACTION_CAPTURE_COUNT ||
    resilienceCaptures.length !== CATALOG_RESILIENCE_CAPTURE_COUNT ||
    contactSheets.length !== CATALOG_CONTACT_SHEET_COUNT ||
    candidateFiles.length !== CATALOG_MANIFEST_ENTRY_COUNT
  ) {
    throw new CatalogFailure("candidate-count-invalid", "catalog-shell");
  }

  const files = candidateFiles.map((filename) => {
    const bytes = readFileSync(filename);
    return {
      path: path.relative(CANDIDATE_ROOT, filename).split(path.sep).join("/"),
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });
  writeFileSync(
    path.join(CANDIDATE_ROOT, "manifest.json"),
    `${JSON.stringify({
      schemaVersion: 3,
      kind: "phase5a1b-canonical-primitives-catalog-candidates",
      ...provenance,
      candidateStatus: "human-review-required-not-a-production-baseline",
      sceneCaptureCount: sceneCaptures.length,
      interactionCaptureCount: interactionCaptures.length,
      resilienceCaptureCount: resilienceCaptures.length,
      contactSheetCount: contactSheets.length,
      evidenceRecordCount: evidence.records.length,
      pngCount: pngFiles.length,
      files,
    }, null, 2)}\n`,
    "utf8",
  );
  if (listFiles(CANDIDATE_ROOT).length !== CATALOG_CANDIDATE_FILE_COUNT) {
    throw new CatalogFailure("candidate-count-invalid", "catalog-shell");
  }
});

async function settleCatalog(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("[data-catalog-scene]").first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function assertFullPageAxe(
  page: Page,
  capture: CatalogFailureCapture,
): Promise<void> {
  const result = await new AxeBuilder({ page }).analyze();
  if (result.violations.length === 0) return;
  throw new CatalogFailure("axe-violation", capture, {
    axeRuleIds: [...new Set(result.violations.map((violation) => violation.id))].sort(
      (left, right) => (left === right ? 0 : left < right ? -1 : 1),
    ),
    axeRuleCount: result.violations.length,
    axeNodeCount: result.violations.reduce(
      (count, violation) => count + violation.nodes.length,
      0,
    ),
  });
}

async function assertNoOverflow(
  page: Page,
  capture: CatalogFailureCapture,
): Promise<void> {
  const overflow = await page.evaluate(() => {
    const targets = [
      ...document.querySelectorAll<HTMLElement>("[data-catalog-scene]"),
      ...document.querySelectorAll<HTMLElement>("[data-ds-portal-root]"),
      ...document.querySelectorAll<HTMLElement>("[data-ds-part='content']"),
      ...document.querySelectorAll<HTMLElement>("[data-ds-part='listbox']"),
    ];
    return {
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      targets: targets.map((target) => {
        const rectangle = target.getBoundingClientRect();
        return {
          id: target.getAttribute("data-catalog-scene") ??
            target.getAttribute("data-ds-component") ??
            target.getAttribute("data-ds-part") ?? "unknown",
          scrollWidth: target.scrollWidth,
          clientWidth: target.clientWidth,
          left: rectangle.left,
          right: rectangle.right,
          position: getComputedStyle(target).position,
        };
      }),
    };
  });
  const overflowing = overflow.targets.find(({ scrollWidth, clientWidth, left, right, position }) =>
    scrollWidth > clientWidth + 1 ||
    ((position === "fixed" || position === "sticky") && (left < -1 || right > overflow.viewport + 1)),
  );
  if (
    overflow.documentWidth > overflow.viewport + 1 ||
    overflow.bodyWidth > overflow.viewport + 1 ||
    overflowing
  ) {
    throw new CatalogFailure("overflow", capture);
  }
}

async function assertMinimumTargetSizes(
  page: Page,
  capture: CatalogFailureCapture,
): Promise<void> {
  const undersized = await page.evaluate(() => {
    const selector = [
      "#main-content a[href]",
      "#main-content button",
      "#main-content input:not([type='hidden'])",
      "#main-content select",
      "#main-content textarea",
      "[data-ds-portal-root] button",
      "[data-ds-portal-root] input:not([type='hidden'])",
      "[data-ds-portal-root] [role='option']",
    ].join(",");
    return [...new Set(document.querySelectorAll<HTMLElement>(selector))]
      .filter((element) => {
        const rectangle = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rectangle.width > 0 && rectangle.height > 0 &&
          style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => {
        const isChoice = element instanceof HTMLInputElement &&
          (element.type === "checkbox" || element.type === "radio");
        const target = isChoice ? element.closest<HTMLElement>("label") ?? element : element;
        const rectangle = target.getBoundingClientRect();
        return {
          component: element.dataset.dsComponent ?? element.dataset.dsPart ?? element.tagName,
          width: rectangle.width,
          height: rectangle.height,
        };
      })
      .find(({ width, height }) => width < 43.5 || height < 43.5) ?? null;
  });
  if (undersized) throw new CatalogFailure("target-size-invalid", capture);
}

async function assertFocusNotObscured(
  locator: CatalogLocator,
  capture: CatalogFailureCapture,
): Promise<void> {
  const focus = await locator.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    const centerX = Math.min(window.innerWidth - 1, Math.max(0, rectangle.left + (rectangle.width / 2)));
    const centerY = Math.min(window.innerHeight - 1, Math.max(0, rectangle.top + (rectangle.height / 2)));
    const elementsAtCenter = document.elementsFromPoint(centerX, centerY);
    return {
      active: element === document.activeElement,
      intersectsViewport: rectangle.right > 0 && rectangle.bottom > 0 &&
        rectangle.left < window.innerWidth && rectangle.top < window.innerHeight,
      centerIsVisible: elementsAtCenter.some((candidate) =>
        candidate === element || element.contains(candidate),
      ),
    };
  });
  if (!focus.active || !focus.intersectsViewport || !focus.centerIsVisible) {
    throw new CatalogFailure("focus-obscured", capture);
  }
}

async function assertVisibleFocus(
  locator: CatalogLocator,
  capture: CatalogFailureCapture,
): Promise<void> {
  await locator.focus();
  const focus = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      active: element === document.activeElement,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  if (!focus.active || focus.outlineStyle === "none" || focus.outlineWidth < 2) {
    throw new CatalogFailure("focus-contract-invalid", capture);
  }
  await assertFocusNotObscured(locator, capture);
}

async function assertPortalScope(
  content: CatalogLocator,
  capture: CatalogFailureCapture,
): Promise<void> {
  const scope = await content.evaluate((element) => {
    const portal = element.closest<HTMLElement>("[data-ds-portal-root]");
    return portal ? {
      designSystem: portal.dataset.designSystem ?? null,
      theme: portal.dataset.theme ?? null,
      lang: portal.lang || null,
      direction: portal.dir || null,
      documentTheme: document.documentElement.dataset.theme ?? null,
      documentLanguage: document.documentElement.lang,
      documentDirection: document.documentElement.dir || "ltr",
    } : null;
  });
  if (
    !scope ||
    scope.designSystem !== "v2" ||
    scope.theme !== scope.documentTheme ||
    scope.lang !== scope.documentLanguage ||
    scope.direction !== scope.documentDirection
  ) {
    throw new CatalogFailure("portal-scope-invalid", capture);
  }
}

function durationsResolveImmediately(value: string): boolean {
  return value.split(",").every((duration) => {
    const normalized = duration.trim();
    if (normalized === "0s" || normalized === "0ms" || normalized === "0") return true;
    const match = /^(\d*\.?\d+)(ms|s)$/u.exec(normalized);
    if (!match) return false;
    return Number(match[1]) === 0;
  });
}

async function assertReducedMotionFinalState(
  content: CatalogLocator,
  capture: CatalogFailureCapture,
): Promise<void> {
  const durations = await content.evaluate((element) =>
    [
      ...[element, ...element.querySelectorAll("*")].map((candidate) => {
        const style = getComputedStyle(candidate);
        return [style.animationDuration, style.transitionDuration];
      }),
      ...(element instanceof HTMLDialogElement
        ? [[
            getComputedStyle(element, "::backdrop").animationDuration,
            getComputedStyle(element, "::backdrop").transitionDuration,
          ]]
        : []),
    ],
  );
  if (durations.some((pair) => pair.some((duration) => !durationsResolveImmediately(duration)))) {
    throw new CatalogFailure("motion-contract-invalid", capture);
  }
}

async function assertForcedColorsFinalState(
  content: CatalogLocator,
  capture: CatalogFailureCapture,
  context: CatalogCaptureContext,
): Promise<void> {
  if (context.forcedColors !== "active") return;
  const shadow = await content.evaluate((element) => getComputedStyle(element).boxShadow);
  if (shadow !== "none") {
    throw new CatalogFailure("forced-colors-contract-invalid", capture);
  }
}

async function assertCatalogEnvironment(
  page: Page,
  errors: readonly CatalogFailureCode[],
  context: CatalogCaptureContext,
): Promise<void> {
  if (errors.length > 0) throw new CatalogFailure("console-error", "catalog-shell");
  const runtime = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>("[data-design-system='v2']");
    const panel = document.querySelector<HTMLElement>(".catalog-v2-panel");
    if (!canvas || !panel) return null;
    const tokens = getComputedStyle(canvas);
    const durationInMilliseconds = (value: string): number | null => {
      const normalized = value.trim();
      if (normalized === "0") return 0;
      const match = /^(-?(?:\d+\.?\d*|\.\d+))(ms|s)$/u.exec(normalized);
      if (!match) return null;
      const amount = Number(match[1]);
      return match[2] === "s" ? amount * 1_000 : amount;
    };
    return {
      language: document.documentElement.lang,
      storedTheme: localStorage.getItem("theme"),
      resolvedTheme: document.documentElement.dataset.theme ?? null,
      prefersDark: matchMedia("(prefers-color-scheme: dark)").matches,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      forcedColors: matchMedia("(forced-colors: active)").matches,
      pointerFine: matchMedia("(pointer: fine)").matches,
      pointerCoarse: matchMedia("(pointer: coarse)").matches,
      hover: matchMedia("(hover: hover)").matches,
      motionDurations: [
        "--ds-motion-duration-instant",
        "--ds-motion-duration-feedback",
        "--ds-motion-duration-fast",
        "--ds-motion-duration-standard",
        "--ds-motion-duration-deliberate",
        "--ds-motion-duration-narrative-max",
      ].map((name) => durationInMilliseconds(tokens.getPropertyValue(name))),
      panelShadow: getComputedStyle(panel).boxShadow,
    };
  });
  if (!runtime) throw new CatalogFailure("theme-contract-invalid", "catalog-shell");
  if (
    runtime.storedTheme !== context.themePreference ||
    runtime.resolvedTheme !== context.colorScheme ||
    runtime.prefersDark !== (context.colorScheme === "dark")
  ) {
    throw new CatalogFailure("theme-contract-invalid", "catalog-shell");
  }
  if (!runtime.language.startsWith(context.locale.slice(0, 2))) {
    throw new CatalogFailure("locale-contract-invalid", "catalog-shell");
  }
  const expectedDurations = context.reducedMotion === "reduce"
    ? [0, 0, 0, 0, 0, 0]
    : [0, 120, 180, 240, 360, 500];
  if (
    runtime.reducedMotion !== (context.reducedMotion === "reduce") ||
    runtime.motionDurations.some((value, index) => value !== expectedDurations[index])
  ) {
    throw new CatalogFailure("motion-contract-invalid", "catalog-shell");
  }
  if (
    runtime.forcedColors !== (context.forcedColors === "active") ||
    (context.forcedColors === "active" && runtime.panelShadow !== "none")
  ) {
    throw new CatalogFailure("forced-colors-contract-invalid", "catalog-shell");
  }
  if (
    runtime.pointerFine !== (context.pointer === "fine") ||
    runtime.pointerCoarse !== (context.pointer === "coarse") ||
    runtime.hover !== (context.hover === "hover")
  ) {
    throw new CatalogFailure("pointer-contract-invalid", "catalog-shell");
  }

  const skipLink = page.locator('a[href="#main-content"]');
  const hiddenBeforeFocus = await skipLink.evaluate((element) => element.getBoundingClientRect().bottom <= 0);
  await skipLink.focus();
  const visibleOnFocus = await skipLink.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    return rectangle.top >= 0 && rectangle.bottom <= window.innerHeight;
  });
  await skipLink.evaluate((element) => (element as HTMLElement).blur());
  const hiddenAfterBlur = await skipLink.evaluate((element) => element.getBoundingClientRect().bottom <= 0);
  if (!hiddenBeforeFocus || !visibleOnFocus || !hiddenAfterBlur) {
    throw new CatalogFailure("skip-link-contract-invalid", "catalog-shell");
  }

  await assertVisibleFocus(
    page.locator('[data-catalog-probe="button-primary"]'),
    "actions-forms",
  );
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

async function assertSystemThemeLiveUpdate(
  page: Page,
  context: CatalogCaptureContext,
): Promise<void> {
  if (context.themePreference !== "system") return;
  const alternateScheme = context.colorScheme === "dark" ? "light" : "dark";
  await page.emulateMedia({
    colorScheme: alternateScheme,
    reducedMotion: context.reducedMotion,
    forcedColors: context.forcedColors,
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(alternateScheme);
  await page.emulateMedia({
    colorScheme: context.colorScheme,
    reducedMotion: context.reducedMotion,
    forcedColors: context.forcedColors,
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(context.colorScheme);
}

async function switchThumbShift(locator: CatalogLocator): Promise<number> {
  return locator.evaluate((element) => {
    const transform = getComputedStyle(element, "::before").transform;
    return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
  });
}

async function assertButtonAndFieldKeyboard(
  page: Page,
  context: CatalogCaptureContext,
): Promise<void> {
  const button = page.locator('[data-catalog-probe="button-primary"]');
  const result = page.locator('[data-catalog-probe="button-result"]');
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(result).toHaveAttribute("data-count", "1");
  await page.keyboard.press("Space");
  await expect(result).toHaveAttribute("data-count", "2");

  const input = page.locator('[data-catalog-probe="field-input"]');
  await input.focus();
  await page.keyboard.type("QA");
  await expect(input).toHaveValue(/QA/u);
  const checkbox = page.locator('[data-catalog-probe="field-checkbox"]');
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
  const toggle = page.locator('[data-catalog-probe="field-switch"]');
  await toggle.focus();
  const previous = await toggle.isChecked();
  await page.keyboard.press("Space");
  if (await toggle.isChecked() === previous) {
    throw new CatalogFailure("interaction-contract-invalid", "actions-forms");
  }
  await expect(toggle).toBeChecked();

  const rtlToggle = page.locator('[data-catalog-probe="field-switch-rtl"]');
  await expect(rtlToggle).toBeChecked();
  await rtlToggle.focus();
  await page.keyboard.press("Space");
  await expect(rtlToggle).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(rtlToggle).toBeChecked();
  if (context.forcedColors === "none") {
    await expect.poll(() => switchThumbShift(toggle)).toBe(20);
    await expect.poll(() => switchThumbShift(rtlToggle)).toBe(-20);
  }
}

async function screenshotInteraction(
  page: Page,
  destination: string,
): Promise<Buffer> {
  return page.screenshot({
    path: destination,
    animations: "disabled",
    style: CANDIDATE_CAPTURE_STYLE,
  });
}

async function pointerActivate(page: Page, locator: CatalogLocator, pointer: "fine" | "coarse") {
  if (pointer === "fine") {
    await locator.click();
    return;
  }
  const box = await locator.boundingBox();
  if (!box) throw new CatalogFailure("pointer-contract-invalid", "catalog-shell");
  await page.touchscreen.tap(box.x + (box.width / 2), box.y + (box.height / 2));
}

async function pointerOutside(page: Page, pointer: "fine" | "coarse"): Promise<void> {
  if (pointer === "fine") {
    await page.mouse.click(1, 1);
  } else {
    await page.touchscreen.tap(1, 1);
  }
}

async function prepareAnchoredInput(
  page: Page,
  input: CatalogLocator,
  capture: CatalogFailureCapture,
): Promise<void> {
  try {
    await input.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await input.evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }));
    await expect(input).toBeFocused();
  } catch {
    throw new CatalogFailure("focus-contract-invalid", capture);
  }
}

interface ComboboxOpenSnapshot {
  readonly activeDescendantPresent: boolean;
  readonly expanded: string | null;
  readonly inputBusy: string | null;
  readonly inputFocused: boolean;
  readonly listboxBusy: string | null;
  readonly listboxVisible: boolean;
  readonly liveStatus: string;
  readonly optionCount: number;
  readonly popupCount: number;
  readonly popupStatus: string;
}

async function readComboboxOpenSnapshot(
  page: Page,
  probeName: string,
): Promise<ComboboxOpenSnapshot> {
  return page.evaluate((name) => {
    const probe = document.querySelector<HTMLElement>(`[data-catalog-probe="${name}"]`);
    const input = probe?.querySelector<HTMLInputElement>('[data-ds-part="input"]') ?? null;
    const controlledId = input?.getAttribute("aria-controls") ?? "";
    const listbox = controlledId
      ? document.getElementById(controlledId)
      : null;
    const popup = listbox?.closest<HTMLElement>(
      '[data-ds-component="combobox"][data-ds-part="content"][data-state="open"]',
    ) ?? null;
    const listboxStyle = listbox ? getComputedStyle(listbox) : null;

    return {
      activeDescendantPresent: Boolean(input?.getAttribute("aria-activedescendant")),
      expanded: input?.getAttribute("aria-expanded") ?? null,
      inputBusy: input?.getAttribute("aria-busy") ?? null,
      inputFocused: document.activeElement === input,
      listboxBusy: listbox?.getAttribute("aria-busy") ?? null,
      listboxVisible: Boolean(
        listbox &&
        listbox.getClientRects().length > 0 &&
        listboxStyle?.display !== "none" &&
        listboxStyle?.visibility !== "hidden",
      ),
      liveStatus: probe?.querySelector<HTMLElement>('[role="status"]')?.textContent?.trim() ?? "",
      optionCount: listbox?.querySelectorAll('[role="option"]').length ?? 0,
      popupCount: document.querySelectorAll(
        '[data-ds-component="combobox"][data-ds-part="content"][data-state="open"]',
      ).length,
      popupStatus: popup?.querySelector<HTMLElement>('[aria-hidden="true"]')?.textContent?.trim() ?? "",
    };
  }, probeName);
}

async function assertComboboxOpenSnapshot(
  page: Page,
  probeName: string,
  expectedStatus: string,
  expectedOptionCount: number,
  expectedBusy: "true" | null,
  expectActiveDescendant: boolean,
  capture: CatalogFailureCapture,
): Promise<void> {
  try {
    await expect.poll(() => readComboboxOpenSnapshot(page, probeName)).toEqual({
      activeDescendantPresent: expectActiveDescendant,
      expanded: "true",
      inputBusy: expectedBusy,
      inputFocused: true,
      listboxBusy: expectedBusy,
      listboxVisible: true,
      liveStatus: expectedStatus,
      optionCount: expectedOptionCount,
      popupCount: 1,
      popupStatus: expectedStatus,
    });
  } catch {
    throw new CatalogFailure("interaction-contract-invalid", capture);
  }
}

async function exerciseNestedMenu(
  page: Page,
  modal: CatalogLocator,
  component: "dialog" | "sheet",
  capture: CatalogFailureCapture,
  context: CatalogCaptureContext,
): Promise<void> {
  const trigger = modal.locator(
    `[data-catalog-probe="${component}-nested-menu"] [data-ds-part="trigger"]`,
  );
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  const nestedMenu = modal.locator(
    '[data-ds-overlay-host] [data-ds-component="menu"][data-ds-part="content"]',
  );
  await expect(nestedMenu).toBeVisible();
  await expect(nestedMenu.locator('[data-ds-part="item"]').first()).toBeFocused();
  await assertPortalScope(nestedMenu, capture);
  await assertForcedColorsFinalState(nestedMenu, capture, context);
  const usesNearestOverlayHost = await nestedMenu.evaluate((element) => {
    const portalRoot = element.closest<HTMLElement>("[data-ds-portal-root]");
    const host = portalRoot?.parentElement;
    return Boolean(
      host?.hasAttribute("data-ds-overlay-host") &&
      host.closest("dialog[open]")?.contains(element),
    );
  });
  if (!usesNearestOverlayHost) throw new CatalogFailure("portal-scope-invalid", capture);
  await assertFocusNotObscured(
    nestedMenu.locator('[data-ds-part="item"]').first(),
    capture,
  );
  await assertMinimumTargetSizes(page, capture);
  await assertFullPageAxe(page, capture);

  await page.keyboard.press("Tab");
  await expect(nestedMenu).toBeHidden();
  await expect(modal.locator('[data-catalog-focus="initial"]')).toBeFocused();

  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(nestedMenu).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(nestedMenu).toBeHidden();
  await expect(modal.locator('[data-ds-part="close"]')).toBeFocused();

  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(nestedMenu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nestedMenu).toBeHidden();
  await expect(modal).toBeVisible();
  await expect(trigger).toBeFocused();

  await pointerActivate(page, trigger, context.pointer);
  await expect(nestedMenu).toBeVisible();
  await pointerOutside(page, context.pointer);
  await expect(nestedMenu).toBeHidden();
  if (!await modal.isVisible()) {
    throw new CatalogFailure("nested-outside-cascade-invalid", capture);
  }
}

async function exerciseNestedCombobox(
  page: Page,
  modal: CatalogLocator,
  component: "dialog" | "sheet",
  capture: CatalogFailureCapture,
  context: CatalogCaptureContext,
): Promise<void> {
  const probe = modal.locator(`[data-catalog-probe="${component}-nested-combobox"]`);
  const input = probe.locator('[data-ds-part="input"]');
  await prepareAnchoredInput(page, input, capture);
  await page.keyboard.press("ArrowDown");
  const popup = modal.locator(
    '[data-ds-overlay-host] [data-ds-component="combobox"][data-ds-part="content"]',
  );
  const listbox = popup.locator('[data-ds-part="listbox"]');
  try {
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await expect(listbox).toBeVisible();
    await expect(listbox.locator('[role="option"]')).toHaveCount(3);
    await assertPortalScope(popup, capture);
    const usesCurrentModalHost = await popup.evaluate((element) => {
      const portalRoot = element.closest<HTMLElement>("[data-ds-portal-root]");
      const host = portalRoot?.parentElement;
      return Boolean(
        host?.hasAttribute("data-ds-overlay-host") &&
        host.closest("dialog[open]") === element.closest("dialog[open]"),
      );
    });
    if (!usesCurrentModalHost) throw new CatalogFailure("portal-scope-invalid", capture);
    if (context.reducedMotion === "reduce") {
      await assertReducedMotionFinalState(popup, capture);
    }
    await assertForcedColorsFinalState(popup, capture, context);
    await assertFocusNotObscured(input, capture);
    await assertNoOverflow(page, capture);
    await assertMinimumTargetSizes(page, capture);
    await assertFullPageAxe(page, capture);

    await page.keyboard.press("Tab");
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await expect(popup).toBeHidden();
    await expect(modal.locator('[data-ds-part="close"]')).toBeFocused();
    await expect(modal).toBeVisible();

    await input.focus();
    await page.keyboard.press("ArrowDown");
    await expect(popup).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(input).toBeFocused();
    await expect(modal).toBeVisible();

    await pointerActivate(page, input, context.pointer);
    await page.keyboard.press("ArrowDown");
    await expect(popup).toBeVisible();
    await pointerOutside(page, context.pointer);
    await expect(popup).toBeHidden();
    if (!await modal.isVisible()) {
      throw new CatalogFailure("nested-outside-cascade-invalid", capture);
    }
  } catch (error) {
    if (error instanceof CatalogFailure) throw error;
    throw new CatalogFailure("focus-containment-invalid", capture);
  }
}

async function exerciseCombobox(
  page: Page,
  destination: string,
  context: CatalogCaptureContext,
): Promise<Buffer> {
  const capture = "actions-forms--combobox-open";
  const probeName = "combobox-ready";
  const probe = page.locator(`[data-catalog-probe="${probeName}"]`);
  const input = probe.locator('[data-ds-part="input"]');
  const expectedStatus = (await probe.locator("p").innerText()).trim();
  if (!expectedStatus) throw new CatalogFailure("interaction-contract-invalid", capture);
  await prepareAnchoredInput(page, input, capture);
  await page.keyboard.press("ArrowDown");
  const popup = page.locator('[data-ds-component="combobox"][data-ds-part="content"]');
  const listbox = popup.locator('[data-ds-part="listbox"]');
  await assertComboboxOpenSnapshot(page, probeName, expectedStatus, 3, null, true, capture);
  await assertFocusNotObscured(input, capture);
  await assertPortalScope(popup, capture);
  if (context.reducedMotion === "reduce") {
    await assertReducedMotionFinalState(popup, capture);
  }
  await assertForcedColorsFinalState(popup, capture, context);
  await assertNoOverflow(page, capture);
  await assertMinimumTargetSizes(page, capture);
  await assertFullPageAxe(page, capture);
  await assertComboboxOpenSnapshot(page, probeName, expectedStatus, 3, null, true, capture);
  const buffer = await screenshotInteraction(page, destination);
  await assertComboboxOpenSnapshot(page, probeName, expectedStatus, 3, null, true, capture);
  try {
    await page.keyboard.press("Enter");
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("ArrowDown");
    await expect(listbox).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await pointerActivate(page, input, context.pointer);
    await page.keyboard.press("ArrowDown");
    await expect(listbox).toBeVisible();
    await pointerOutside(page, context.pointer);
    await expect(input).toHaveAttribute("aria-expanded", "false");
  } catch (error) {
    if (error instanceof CatalogFailure) throw error;
    throw new CatalogFailure("interaction-contract-invalid", capture);
  }
  return buffer;
}

async function exerciseComboboxStatus(
  page: Page,
  state: "loading" | "empty" | "error",
  capture: CatalogCaptureId,
  destination: string,
  context: CatalogCaptureContext,
): Promise<Buffer> {
  const probeName = `combobox-${state}`;
  const probe = page.locator(`[data-catalog-probe="${probeName}"]`);
  const input = probe.locator('[data-ds-part="input"]');
  const expectedStatus = (await probe.locator("p").innerText()).trim();
  if (!expectedStatus) throw new CatalogFailure("interaction-contract-invalid", capture);
  await prepareAnchoredInput(page, input, capture);
  await page.keyboard.press("ArrowDown");
  const popup = page.locator('[data-ds-component="combobox"][data-ds-part="content"]');
  const expectedBusy = state === "loading" ? "true" : null;
  await assertComboboxOpenSnapshot(
    page,
    probeName,
    expectedStatus,
    0,
    expectedBusy,
    false,
    capture,
  );
  await assertFocusNotObscured(input, capture);
  await assertPortalScope(popup, capture);
  if (context.reducedMotion === "reduce") await assertReducedMotionFinalState(popup, capture);
  await assertForcedColorsFinalState(popup, capture, context);
  await assertNoOverflow(page, capture);
  await assertMinimumTargetSizes(page, capture);
  await assertFullPageAxe(page, capture);
  await assertComboboxOpenSnapshot(
    page,
    probeName,
    expectedStatus,
    0,
    expectedBusy,
    false,
    capture,
  );
  const buffer = await screenshotInteraction(page, destination);
  await assertComboboxOpenSnapshot(
    page,
    probeName,
    expectedStatus,
    0,
    expectedBusy,
    false,
    capture,
  );
  try {
    await page.keyboard.press("Escape");
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("aria-expanded", "false");
  } catch {
    throw new CatalogFailure("interaction-contract-invalid", capture);
  }
  return buffer;
}

async function exerciseModal(
  page: Page,
  component: "dialog" | "sheet",
  destination: string,
  context: CatalogCaptureContext,
): Promise<Buffer> {
  const capture = `overlays-navigation--${component}-open` as const;
  const trigger = page.locator(`[data-catalog-probe="${component}-trigger"]`);
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const content = page.locator(`dialog[data-ds-component="${component}"][open]`);
  await expect(content).toBeVisible();
  const initialAction = content.locator('[data-catalog-focus="initial"]');
  const initialFocus = component === "sheet"
    ? content.getByRole("heading")
    : initialAction;
  const lastFocus = content.locator(
    `[data-catalog-probe="${component}-nested-combobox"] [data-ds-part="input"]`,
  );
  const firstCycleFocus = content.locator('[data-ds-part="close"]');
  await expect(initialFocus).toBeFocused();
  await assertFocusNotObscured(initialFocus, capture);
  if (component === "sheet") {
    await page.keyboard.press("Shift+Tab");
    if (!await lastFocus.evaluate((element) => element === document.activeElement)) {
      throw new CatalogFailure("focus-containment-invalid", capture);
    }
    await initialFocus.focus();
    await page.keyboard.press("Tab");
    if (!await firstCycleFocus.evaluate((element) => element === document.activeElement)) {
      throw new CatalogFailure("focus-containment-invalid", capture);
    }
  }
  await lastFocus.focus();
  await page.keyboard.press("Tab");
  if (!await firstCycleFocus.evaluate((element) => element === document.activeElement)) {
    throw new CatalogFailure("focus-containment-invalid", capture);
  }
  await assertFocusNotObscured(firstCycleFocus, capture);
  await page.keyboard.press("Shift+Tab");
  if (!await lastFocus.evaluate((element) => element === document.activeElement)) {
    throw new CatalogFailure("focus-containment-invalid", capture);
  }
  await assertFocusNotObscured(lastFocus, capture);
  await trigger.evaluate((element) => (element as HTMLElement).focus());
  const backgroundFocusRejected = await content.evaluate((element) =>
    element.contains(document.activeElement),
  );
  if (!backgroundFocusRejected) {
    throw new CatalogFailure("focus-containment-invalid", capture);
  }
  await initialAction.focus();
  await assertFocusNotObscured(initialAction, capture);
  await assertPortalScope(content, capture);
  if (context.reducedMotion === "reduce") await assertReducedMotionFinalState(content, capture);
  await assertForcedColorsFinalState(content, capture, context);
  await assertNoOverflow(page, capture);
  await assertMinimumTargetSizes(page, capture);
  await assertFullPageAxe(page, capture);
  const buffer = await screenshotInteraction(page, destination);
  await exerciseNestedMenu(page, content, component, capture, context);
  await exerciseNestedCombobox(page, content, component, capture, context);
  await page.keyboard.press("Escape");
  await expect(content).toBeHidden();
  if (!await trigger.evaluate((element) => element === document.activeElement)) {
    throw new CatalogFailure("focus-restoration-invalid", capture);
  }
  await pointerActivate(page, trigger, context.pointer);
  await expect(content).toBeVisible();
  await pointerOutside(page, context.pointer);
  await expect(content).toBeHidden();
  if (!await trigger.evaluate((element) => element === document.activeElement)) {
    throw new CatalogFailure("focus-restoration-invalid", capture);
  }
  return buffer;
}

async function exerciseMenu(
  page: Page,
  destination: string,
  context: CatalogCaptureContext,
): Promise<Buffer> {
  const capture = "overlays-navigation--menu-open";
  const trigger = page.locator('[data-catalog-probe="menu"] [data-ds-part="trigger"]');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  const menu = page.locator('[data-ds-component="menu"][data-ds-part="content"]');
  const items = menu.locator('[data-ds-part="item"]');
  await expect(menu).toBeVisible();
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(items.last()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await expect(items.last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(items.first()).toBeFocused();
  const typeaheadCharacter = await items.nth(2).evaluate((element) =>
    element.textContent?.trim().slice(0, 1) ?? "",
  );
  if (!typeaheadCharacter) throw new CatalogFailure("interaction-contract-invalid", capture);
  await page.keyboard.type(typeaheadCharacter);
  await expect(items.nth(2)).toBeFocused();
  await expect(items.nth(2)).toHaveAttribute("role", "menuitemcheckbox");
  await expect(items.nth(2)).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Space");
  await expect(menu).toBeVisible();
  await expect(items.nth(2)).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Space");
  await expect(items.nth(2)).toHaveAttribute("aria-checked", "true");
  await assertFocusNotObscured(items.nth(2), capture);
  await assertPortalScope(menu, capture);
  if (context.reducedMotion === "reduce") await assertReducedMotionFinalState(menu, capture);
  await assertForcedColorsFinalState(menu, capture, context);
  await assertNoOverflow(page, capture);
  await assertMinimumTargetSizes(page, capture);
  await assertFullPageAxe(page, capture);
  const buffer = await screenshotInteraction(page, destination);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
  await expect(
    page.locator('[data-catalog-probe="tooltip"] [data-ds-part="trigger"]'),
  ).toBeFocused();
  await pointerActivate(page, trigger, context.pointer);
  await expect(menu).toBeVisible();
  await pointerOutside(page, context.pointer);
  await expect(menu).toBeHidden();
  return buffer;
}

async function exerciseTabs(page: Page, destination: string): Promise<Buffer> {
  const capture = "overlays-navigation--tabs-keyboard-selected";
  const tabs = page.locator('[data-catalog-probe="tabs"] [data-ds-component="tabs"]');
  await tabs.scrollIntoViewIfNeeded();
  const tabItems = tabs.locator('[data-ds-part="tab"]');
  await tabItems.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabItems.nth(1)).toBeFocused();
  if (await tabItems.nth(1).getAttribute("aria-selected") !== "true") {
    await page.keyboard.press("Space");
  }
  await expect(tabItems.nth(1)).toHaveAttribute("aria-selected", "true");
  await assertFocusNotObscured(tabItems.nth(1), capture);
  await expect(tabs.locator('[data-ds-part="tabpanel"]:visible')).toHaveCount(1);
  const tabbableCount = await tabItems.evaluateAll((elements) =>
    elements.filter((element) => element.getAttribute("tabindex") === "0").length,
  );
  if (tabbableCount !== 1) throw new CatalogFailure("interaction-contract-invalid", capture);
  await assertNoOverflow(page, capture);
  await assertMinimumTargetSizes(page, capture);
  await assertFullPageAxe(page, capture);
  const buffer = await screenshotInteraction(page, destination);
  await page.keyboard.press("Home");
  await expect(tabItems.first()).toBeFocused();
  return buffer;
}

async function exerciseTooltip(
  page: Page,
  destination: string,
  context: CatalogCaptureContext,
): Promise<Buffer> {
  const capture = "overlays-navigation--tooltip-focus-open";
  const trigger = page.locator('[data-catalog-probe="tooltip"] [data-ds-part="trigger"]');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  const tooltip = page.locator('[data-ds-component="tooltip"][data-ds-part="content"]');
  await expect(tooltip).toBeVisible();
  await assertFocusNotObscured(trigger, capture);
  await assertPortalScope(tooltip, capture);
  if (context.reducedMotion === "reduce") await assertReducedMotionFinalState(tooltip, capture);
  await assertForcedColorsFinalState(tooltip, capture, context);
  await assertNoOverflow(page, capture);
  await assertMinimumTargetSizes(page, capture);
  await assertFullPageAxe(page, capture);
  const buffer = await screenshotInteraction(page, destination);
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
  await expect(trigger).toBeFocused();
  if (context.hover === "hover") {
    await page.mouse.move(1, 1);
    await trigger.evaluate((element) => (element as HTMLElement).blur());
    await trigger.hover();
    await expect(tooltip).toBeVisible();
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.mouse.move(1, 1);
    await expect(tooltip).toBeHidden();
  }
  return buffer;
}

async function assertNoClippedOverlappingOrObscuredContent(
  page: Page,
  capture: CatalogFailureCapture,
  failureCode: "text-spacing-contract-invalid" | "zoom-contract-invalid",
): Promise<void> {
  const issue = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-design-system='v2']");
    if (!root) return "root-missing";
    const rendered = (element: HTMLElement): boolean => {
      const style = getComputedStyle(element);
      const rectangle = element.getBoundingClientRect();
      return style.display !== "none" &&
        style.visibility !== "hidden" &&
        rectangle.width > 2 &&
        rectangle.height > 2;
    };
    const directTextRectangles = (element: HTMLElement): DOMRect[] => {
      if (element.matches("input, select, textarea")) return [element.getBoundingClientRect()];
      return [...element.childNodes].flatMap((node) => {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return [];
        const range = document.createRange();
        range.selectNodeContents(node);
        return [...range.getClientRects()].filter(
          (rectangle) => rectangle.width > 0 && rectangle.height > 0,
        );
      });
    };
    const candidates = [root, ...root.querySelectorAll<HTMLElement>("*")]
      .filter(rendered)
      .map((element) => ({ element, rectangles: directTextRectangles(element) }))
      .filter(({ rectangles }) => rectangles.length > 0);

    for (const { element, rectangles } of candidates) {
      for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        const clipsInline = style.overflowX === "hidden" || style.overflowX === "clip";
        const clipsBlock = style.overflowY === "hidden" || style.overflowY === "clip";
        if (!clipsInline && !clipsBlock) continue;
        if (
          (clipsInline && ancestor.scrollWidth > ancestor.clientWidth + 1) ||
          (clipsBlock && ancestor.scrollHeight > ancestor.clientHeight + 1)
        ) return "content-clipped";
        const boundary = ancestor.getBoundingClientRect();
        const clipped = rectangles.some((rectangle) =>
          (clipsInline && (rectangle.left < boundary.left - 1 || rectangle.right > boundary.right + 1)) ||
          (clipsBlock && (rectangle.top < boundary.top - 1 || rectangle.bottom > boundary.bottom + 1)),
        );
        if (clipped) return "text-clipped";
        if (ancestor === root) break;
      }
    }

    for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
      const left = candidates[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
        const right = candidates[rightIndex];
        if (
          left.element.parentElement !== right.element.parentElement ||
          left.element.contains(right.element) ||
          right.element.contains(left.element)
        ) continue;
        const overlaps = left.rectangles.some((leftRectangle) =>
          right.rectangles.some((rightRectangle) =>
            Math.min(leftRectangle.right, rightRectangle.right) -
                Math.max(leftRectangle.left, rightRectangle.left) > 1 &&
              Math.min(leftRectangle.bottom, rightRectangle.bottom) -
                Math.max(leftRectangle.top, rightRectangle.top) > 1,
          ),
        );
        if (overlaps) return "text-overlap";
      }
    }

    const obscured = candidates.some(({ element, rectangles }) =>
      rectangles.some((rectangle) => {
        const x = rectangle.left + (rectangle.width / 2);
        const y = rectangle.top + (rectangle.height / 2);
        if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
        const top = document.elementFromPoint(x, y);
        return Boolean(
          top &&
          top !== element &&
          !element.contains(top) &&
          !top.contains(element),
        );
      }),
    );
    return obscured ? "text-obscured" : null;
  });
  if (issue) throw new CatalogFailure(failureCode, capture);
}

async function assertTextSpacing(page: Page, destination: string): Promise<void> {
  const style = await page.addStyleTag({ content: TEXT_SPACING_STYLE });
  try {
    await assertNoOverflow(page, CATALOG_TEXT_SPACING_CAPTURE_ID);
    await assertNoClippedOverlappingOrObscuredContent(
      page,
      CATALOG_TEXT_SPACING_CAPTURE_ID,
      "text-spacing-contract-invalid",
    );
    await page.locator("#main-content").screenshot({
      path: destination,
      animations: "disabled",
    });
  } finally {
    await style.evaluate((element) => element.remove());
  }
}

async function assertZoom200Reflow(
  page: Page,
  viewport: CatalogCaptureViewport,
  destination: string | undefined,
): Promise<void> {
  if (viewport.width !== 768) return;
  if (!destination) throw new CatalogFailure("zoom-contract-invalid", CATALOG_ZOOM_CAPTURE_ID);
  await page.setViewportSize({
    width: Math.floor(viewport.width / 2),
    height: Math.floor(viewport.height / 2),
  });
  try {
    await assertNoOverflow(page, CATALOG_ZOOM_CAPTURE_ID);
    await expect(page.locator("#main-content")).toBeVisible();
    await assertNoClippedOverlappingOrObscuredContent(
      page,
      CATALOG_ZOOM_CAPTURE_ID,
      "zoom-contract-invalid",
    );
    await page.locator("#main-content").screenshot({
      path: destination,
      animations: "disabled",
    });
  } catch (error) {
    if (error instanceof CatalogFailure) throw error;
    throw new CatalogFailure("zoom-contract-invalid", CATALOG_ZOOM_CAPTURE_ID);
  } finally {
    await page.setViewportSize(viewport);
  }
}

async function writeContactSheet(
  buffers: readonly Buffer[],
  destination: string,
  background: string,
): Promise<void> {
  if (buffers.length === 0) throw new CatalogFailure("unexpected", "catalog-shell");
  const sourceMetadata = await Promise.all(buffers.map((buffer) => sharp(buffer).metadata()));
  const sourceWidths = sourceMetadata.map((metadata) => metadata.width ?? 0);
  if (sourceWidths.some((width) => width <= 0)) throw new CatalogFailure("unexpected", "catalog-shell");
  const columns = 2;
  const cellWidth = Math.min(720, Math.max(...sourceWidths));
  const gap = 16;
  const cells = await Promise.all(buffers.map(async (buffer) => {
    const input = await sharp(buffer)
      .resize({ width: cellWidth, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const metadata = await sharp(input).metadata();
    if (!metadata.width || !metadata.height) throw new CatalogFailure("unexpected", "catalog-shell");
    return { input, width: metadata.width, height: metadata.height };
  }));
  const rowCount = Math.ceil(cells.length / columns);
  const rowHeights = Array.from({ length: rowCount }, (_, row) =>
    Math.max(...cells.slice(row * columns, (row + 1) * columns).map((cell) => cell.height)),
  );
  const rowOffsets = rowHeights.map((_, row) =>
    gap + rowHeights.slice(0, row).reduce((total, height) => total + height + gap, 0),
  );
  const canvasWidth = (cellWidth * columns) + (gap * (columns + 1));
  const canvasHeight = rowHeights.reduce((total, height) => total + height, 0) +
    (gap * (rowCount + 1));
  await sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 4, background },
  })
    .composite(cells.map((cell, index) => ({
      input: cell.input,
      left: gap + ((index % columns) * (cellWidth + gap)) +
        Math.floor((cellWidth - cell.width) / 2),
      top: rowOffsets[Math.floor(index / columns)],
    })))
    .png()
    .toFile(destination);
}

async function retainSafeDiagnostic(
  page: Page,
  caseId: string,
  failure: CatalogFailure,
): Promise<void> {
  const directory = path.join(DIAGNOSTIC_ROOT, caseId);
  mkdirSync(directory, { recursive: true });
  const isCatalogDocument = new URL(page.url()).pathname === CATALOG_PATH &&
    await page.locator("[data-design-system='v2']").count() > 0;
  if (isCatalogDocument) {
    const scene = CATALOG_SCENE_IDS.find((candidate) => failure.capture.startsWith(candidate));
    const target = scene
      ? page.locator(`[data-catalog-scene='${scene}']`)
      : page.locator("#main-content");
    if (await target.count()) {
      await target.first().screenshot({
        path: path.join(directory, `${failure.capture}.png`),
        animations: "disabled",
      }).catch(() => undefined);
    }
  }
  writeFileSync(
    path.join(directory, "diagnostic.json"),
    `${JSON.stringify({
      schemaVersion: 2,
      caseId,
      failureCode: failure.code,
      capture: failure.capture,
      ...(failure.diagnostic ? { diagnostic: failure.diagnostic } : {}),
    }, null, 2)}\n`,
    "utf8",
  );
}

for (const viewport of CATALOG_CAPTURE_VIEWPORTS) {
  for (const context of CATALOG_CAPTURE_CONTEXTS) {
    test.describe(`${context.id} ${viewport.width}x${viewport.height}`, () => {
      test.use({
        locale: context.locale,
        hasTouch: context.pointer === "coarse",
      });

      test("captures the exact canonical primitive matrix", async ({ page }) => {
        const caseId = getCatalogCaptureCaseId(context, viewport);
        const errors: CatalogFailureCode[] = [];
        page.on("pageerror", () => errors.push("console-error"));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push("console-error");
        });
        try {
          await page.setViewportSize(viewport);
          await page.clock.setFixedTime(FIXED_TIME);
          await page.addInitScript(
            (theme) => localStorage.setItem("theme", theme),
            context.themePreference,
          );
          await page.emulateMedia({
            colorScheme: context.colorScheme,
            reducedMotion: context.reducedMotion,
            forcedColors: context.forcedColors,
          });
          const response = await page.goto(CATALOG_PATH);
          if (!response?.ok() || new URL(page.url()).pathname !== CATALOG_PATH) {
            throw new CatalogFailure("catalog-route-unavailable", "catalog-shell");
          }
          await page.locator("[data-design-system='v2']").first().waitFor({
            state: "attached",
            timeout: 5_000,
          }).catch(() => {
            throw new CatalogFailure("catalog-route-unavailable", "catalog-shell");
          });
          await settleCatalog(page);
          await expect(page.locator("[data-testid='living-label-v2-foundation']")).toBeVisible();
          await expect(page.locator("[data-testid='living-label-v2-evidence']")).toBeVisible();
          await assertCatalogEnvironment(page, errors, context);
          await assertNoOverflow(page, "catalog-shell");
          await assertMinimumTargetSizes(page, "catalog-shell");
          await assertFullPageAxe(page, "catalog-shell");

          const candidateDirectory = path.join(CANDIDATE_ROOT, caseId);
          mkdirSync(candidateDirectory, { recursive: true });
          const baseBuffers: Buffer[] = [];
          for (const scene of CATALOG_SCENE_IDS) {
            const destination = path.join(candidateDirectory, `${scene}.png`);
            baseBuffers.push(await page.locator(`[data-catalog-scene='${scene}']`).screenshot({
              path: destination,
              animations: "disabled",
              style: CANDIDATE_CAPTURE_STYLE,
            }));
          }

          await assertButtonAndFieldKeyboard(page, context);
          const interactionBuffers = [
            await exerciseCombobox(
              page,
              path.join(candidateDirectory, "actions-forms--combobox-open.png"),
              context,
            ),
            await exerciseComboboxStatus(
              page,
              "loading",
              "actions-forms--combobox-loading-open",
              path.join(candidateDirectory, "actions-forms--combobox-loading-open.png"),
              context,
            ),
            await exerciseComboboxStatus(
              page,
              "empty",
              "actions-forms--combobox-empty-open",
              path.join(candidateDirectory, "actions-forms--combobox-empty-open.png"),
              context,
            ),
            await exerciseComboboxStatus(
              page,
              "error",
              "actions-forms--combobox-error-open",
              path.join(candidateDirectory, "actions-forms--combobox-error-open.png"),
              context,
            ),
            await exerciseModal(
              page,
              "dialog",
              path.join(candidateDirectory, "overlays-navigation--dialog-open.png"),
              context,
            ),
            await exerciseModal(
              page,
              "sheet",
              path.join(candidateDirectory, "overlays-navigation--sheet-open.png"),
              context,
            ),
            await exerciseMenu(
              page,
              path.join(candidateDirectory, "overlays-navigation--menu-open.png"),
              context,
            ),
            await exerciseTabs(
              page,
              path.join(candidateDirectory, "overlays-navigation--tabs-keyboard-selected.png"),
            ),
            await exerciseTooltip(
              page,
              path.join(candidateDirectory, "overlays-navigation--tooltip-focus-open.png"),
              context,
            ),
          ];

          await writeContactSheet(
            baseBuffers,
            path.join(candidateDirectory, "contact-sheet.png"),
            context.contactSheetBackground,
          );
          await writeContactSheet(
            interactionBuffers,
            path.join(candidateDirectory, "interaction-contact-sheet.png"),
            context.contactSheetBackground,
          );

          await assertSystemThemeLiveUpdate(page, context);
          await assertTextSpacing(
            page,
            path.join(candidateDirectory, `${CATALOG_TEXT_SPACING_CAPTURE_ID}.png`),
          );
          await assertZoom200Reflow(
            page,
            viewport,
            viewport.width === 768
              ? path.join(candidateDirectory, `${CATALOG_ZOOM_CAPTURE_ID}.png`)
              : undefined,
          );
          await assertNoOverflow(page, "catalog-shell");
          if (errors.length > 0) throw new CatalogFailure("console-error", "catalog-shell");
          completedCaseIds.add(caseId);
        } catch (error) {
          const failure = error instanceof CatalogFailure
            ? error
            : new CatalogFailure("unexpected", "catalog-shell");
          await retainSafeDiagnostic(page, caseId, failure);
          throw new Error(`[PHASE5A1_CATALOG] ${caseId}:${failure.capture}:${failure.code}`);
        }
      });
    });
  }
}
