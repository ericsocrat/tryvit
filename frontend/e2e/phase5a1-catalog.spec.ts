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
  CATALOG_CAPTURE_CONTEXTS,
  CATALOG_CAPTURE_COUNT,
  CATALOG_CAPTURE_VIEWPORTS,
  CATALOG_SCENE_IDS,
  parseCatalogSourceStatus,
  type CatalogSceneId,
} from "@/../tooling/design-system/catalog/capture-contract.ts";

const CATALOG_PATH = "/dev/components";
const FIXED_TIME = new Date("2026-01-01T12:00:00.000Z");
const CANDIDATE_ROOT = path.resolve(process.cwd(), "test-results", "phase5a1-catalog-candidates");
const DIAGNOSTIC_ROOT = path.resolve(process.cwd(), "test-results", "phase5a1-catalog-diagnostics");
const EXPECTED_CAPTURE_CASES = CATALOG_CAPTURE_CONTEXTS.length * CATALOG_CAPTURE_VIEWPORTS.length;
const EXPECTED_CONTACT_SHEETS = EXPECTED_CAPTURE_CASES;
const EXPECTED_PNG_FILES = CATALOG_CAPTURE_COUNT + EXPECTED_CONTACT_SHEETS;
const CANDIDATE_CAPTURE_STYLE = 'a[href="#main-content"] { visibility: hidden !important; }';

type CatalogFailureCode =
  | "axe-violation"
  | "catalog-route-unavailable"
  | "console-error"
  | "focus-contract-invalid"
  | "forced-colors-contract-invalid"
  | "locale-contract-invalid"
  | "motion-contract-invalid"
  | "overflow"
  | "skip-link-contract-invalid"
  | "theme-contract-invalid"
  | "unexpected";

type CatalogFailureScene = CatalogSceneId | "catalog-shell";

interface CatalogFailureDiagnostic {
  readonly axeRuleIds?: readonly string[];
  readonly axeRuleCount?: number;
  readonly axeNodeCount?: number;
  readonly axeSceneIds?: readonly CatalogFailureScene[];
}

class CatalogFailure extends Error {
  constructor(
    readonly code: CatalogFailureCode,
    readonly scene: CatalogFailureScene,
    readonly diagnostic?: CatalogFailureDiagnostic,
  ) {
    super(`[PHASE5A1_CATALOG] ${code}:${scene}`);
  }
}

test.use({ serviceWorkers: "block" });
test.describe.configure({ mode: "serial", retries: 0 });

let capturedCases = 0;

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
  const workingTreeStatus = sourceStatus.status;
  const sourceState = sourceStatus.state;
  if (process.env.CI && sourceState === "dirty-development-worktree") {
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
    sourceState,
    sourceWorktreeSha: createHash("sha256")
      .update(`${workingTreeStatus}\0${workingTreeDiff}`, "utf8")
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
  if (capturedCases !== EXPECTED_CAPTURE_CASES) return;
  const pngFiles = listFiles(CANDIDATE_ROOT).filter((filename) => filename.endsWith(".png"));
  const contactSheets = pngFiles.filter((filename) => path.basename(filename) === "contact-sheet.png");
  const sceneCaptures = pngFiles.filter((filename) => path.basename(filename) !== "contact-sheet.png");
  if (
    pngFiles.length !== EXPECTED_PNG_FILES ||
    sceneCaptures.length !== CATALOG_CAPTURE_COUNT ||
    contactSheets.length !== EXPECTED_CONTACT_SHEETS
  ) {
    throw new Error("[PHASE5A1_CATALOG] candidate-count-invalid");
  }
  const files = pngFiles.map((filename) => {
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
      schemaVersion: 2,
      kind: "phase5a1-foundation-catalog-candidates",
      ...sourceProvenance(),
      candidateStatus: "human-review-required-not-a-production-baseline",
      sceneCaptureCount: sceneCaptures.length,
      contactSheetCount: contactSheets.length,
      files,
    }, null, 2)}\n`,
    "utf8",
  );
});

async function settleCatalog(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("[data-catalog-scene]").first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function identifyAxeScenes(page: Page): Promise<readonly CatalogFailureScene[]> {
  const failingScenes: CatalogSceneId[] = [];
  for (const scene of CATALOG_SCENE_IDS) {
    const result = await new AxeBuilder({ page })
      .include(`[data-catalog-scene='${scene}']`)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
      .analyze();
    if (result.violations.length > 0) failingScenes.push(scene);
  }
  return failingScenes.length > 0 ? failingScenes : ["catalog-shell"];
}

async function assertCatalogHealth(
  page: Page,
  errors: readonly CatalogFailureCode[],
  context: (typeof CATALOG_CAPTURE_CONTEXTS)[number],
): Promise<void> {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    scenes: [...document.querySelectorAll<HTMLElement>("[data-catalog-scene]")].map((scene) => {
      const rectangle = scene.getBoundingClientRect();
      return {
        id: scene.getAttribute("data-catalog-scene"),
        scrollWidth: scene.scrollWidth,
        clientWidth: scene.clientWidth,
        left: rectangle.left,
        right: rectangle.right,
      };
    }),
  }));
  const overflowing = overflow.scenes.find(({ scrollWidth, clientWidth, left, right }) =>
    scrollWidth > clientWidth + 1 || left < -1 || right > overflow.viewport + 1,
  );
  if (
    overflow.documentWidth > overflow.viewport ||
    overflow.bodyWidth > overflow.viewport ||
    overflowing
  ) {
    const scene = CATALOG_SCENE_IDS.find((candidate) => candidate === overflowing?.id);
    throw new CatalogFailure("overflow", scene ?? "catalog-shell");
  }
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

  const skipLink = page.locator('a[href="#main-content"]');
  const skipLinkHiddenBeforeFocus = await skipLink.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    return rectangle.bottom <= 0;
  });
  await skipLink.focus();
  const skipLinkVisibleOnFocus = await skipLink.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    return rectangle.top >= 0 && rectangle.bottom <= window.innerHeight;
  });
  await skipLink.evaluate((element) => (element as HTMLElement).blur());
  const skipLinkHiddenAfterBlur = await skipLink.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    return rectangle.bottom <= 0;
  });
  if (!skipLinkHiddenBeforeFocus || !skipLinkVisibleOnFocus || !skipLinkHiddenAfterBlur) {
    throw new CatalogFailure("skip-link-contract-invalid", "catalog-shell");
  }

  const focusProbe = page.locator(".catalog-v2-button").first();
  await focusProbe.focus();
  const focus = await focusProbe.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
  });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  if (focus.outlineStyle === "none" || focus.outlineWidth < 2) {
    throw new CatalogFailure("focus-contract-invalid", "actions-forms");
  }

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
    .analyze();
  if (axe.violations.length > 0) {
    const axeSceneIds = await identifyAxeScenes(page);
    throw new CatalogFailure(
      "axe-violation",
      axeSceneIds[0],
      {
        axeRuleIds: [...new Set(axe.violations.map((violation) => violation.id))].sort(
          (left, right) => (left === right ? 0 : left < right ? -1 : 1),
        ),
        axeRuleCount: axe.violations.length,
        axeNodeCount: axe.violations.reduce(
          (count, violation) => count + violation.nodes.length,
          0,
        ),
        axeSceneIds,
      },
    );
  }
}

async function writeContactSheet(
  buffers: readonly Buffer[],
  destination: string,
  background: string,
): Promise<void> {
  const sourceMetadata = await Promise.all(buffers.map((buffer) => sharp(buffer).metadata()));
  const sourceWidths = sourceMetadata.map((metadata) => metadata.width ?? 0);
  if (sourceWidths.some((width) => width <= 0)) {
    throw new CatalogFailure("unexpected", "catalog-shell");
  }
  const cellWidth = Math.min(720, Math.max(...sourceWidths));
  const gap = 16;
  const cells = await Promise.all(buffers.map(async (buffer) => {
    const input = await sharp(buffer)
      .resize({ width: cellWidth, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const metadata = await sharp(input).metadata();
    if (!metadata.width || !metadata.height) {
      throw new CatalogFailure("unexpected", "catalog-shell");
    }
    return { input, width: metadata.width, height: metadata.height };
  }));
  const rowHeights = [
    Math.max(cells[0].height, cells[1].height),
    Math.max(cells[2].height, cells[3].height),
  ];
  const canvasWidth = (cellWidth * 2) + (gap * 3);
  const canvasHeight = rowHeights[0] + rowHeights[1] + (gap * 3);
  await sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 4, background },
  })
    .composite(cells.map((cell, index) => ({
      input: cell.input,
      left: gap + ((index % 2) * (cellWidth + gap)) + Math.floor((cellWidth - cell.width) / 2),
      top: gap + (index < 2 ? 0 : rowHeights[0] + gap),
    })))
    .png()
    .toFile(destination);
}

async function retainSafeDiagnostic(
  page: Page,
  contextId: string,
  viewport: { readonly width: number; readonly height: number },
  failure: CatalogFailure,
): Promise<void> {
  const directory = path.join(DIAGNOSTIC_ROOT, `${contextId}-${viewport.width}x${viewport.height}`);
  mkdirSync(directory, { recursive: true });
  const isCatalogDocument = new URL(page.url()).pathname === CATALOG_PATH &&
    await page.locator("[data-design-system='v2']").count() > 0;
  const scene = failure.scene === "catalog-shell"
    ? page.locator("#main-content")
    : page.locator(`[data-catalog-scene='${failure.scene}']`);
  if (isCatalogDocument && await scene.count()) {
    await scene.first().screenshot({
      path: path.join(directory, `${failure.scene}.png`),
      animations: "disabled",
    }).catch(() => undefined);
  }
  writeFileSync(
    path.join(directory, "diagnostic.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      contextId,
      viewport,
      failureCode: failure.code,
      scene: failure.scene,
      ...(failure.diagnostic ? { diagnostic: failure.diagnostic } : {}),
    }, null, 2)}\n`,
    "utf8",
  );
}

for (const viewport of CATALOG_CAPTURE_VIEWPORTS) {
  for (const context of CATALOG_CAPTURE_CONTEXTS) {
    test.describe(`${context.id} ${viewport.width}x${viewport.height}`, () => {
      test.use({ locale: context.locale });

      test("captures four deterministic scenes", async ({ page }) => {
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
          await assertCatalogHealth(page, errors, context);

          const candidateDirectory = path.join(
            CANDIDATE_ROOT,
            `${context.id}-${viewport.width}x${viewport.height}`,
          );
          mkdirSync(candidateDirectory, { recursive: true });
          const buffers: Buffer[] = [];
          for (const scene of CATALOG_SCENE_IDS) {
            const destination = path.join(candidateDirectory, `${scene}.png`);
            buffers.push(await page.locator(`[data-catalog-scene='${scene}']`).screenshot({
              path: destination,
              animations: "disabled",
              style: CANDIDATE_CAPTURE_STYLE,
            }));
          }
          await writeContactSheet(
            buffers,
            path.join(candidateDirectory, "contact-sheet.png"),
            context.contactSheetBackground,
          );
          capturedCases += 1;
        } catch (error) {
          const failure = error instanceof CatalogFailure
            ? error
            : new CatalogFailure("unexpected", "catalog-shell");
          await retainSafeDiagnostic(page, context.id, viewport, failure);
          throw new Error(
            `[PHASE5A1_CATALOG] ${context.id}:${viewport.width}x${viewport.height}:${failure.scene}:${failure.code}`,
          );
        }
      });
    });
  }
}
