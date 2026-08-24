import { statSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import sharp from "sharp";

import {
  GOLDEN_MAX_PNG_BYTES,
  GOLDEN_MAX_VIDEO_BYTES,
  GOLDEN_VIDEO_FIRST_FRAME_TIMEOUT_MS,
  goldenCandidateRoot,
  goldenRoute,
  motionRecordingRelativePath,
  type GOLDEN_MOTION_RECORDINGS,
} from "@/../tooling/design-system/golden-reference/capture-contract";
import {
  ensureOwnedDirectory,
  prepareOwnedFileTarget,
} from "@/../tooling/design-system/direction-selection/evidence-safety";
import {
  CATALOG_SCROLL_QUIESCENCE_TIMEOUT_MS,
  CATALOG_SCROLL_QUIET_FRAMES_REQUIRED,
} from "./catalog-scroll-quiescence";

type GoldenPageCapture = Readonly<{
  reference: "landing" | "authentication" | "home" | "search" | "product" | "scanner";
  width: number;
  height: number;
  locale: "en" | "pl" | "de";
  theme: "light" | "dark";
  motion: "full" | "reduced";
  state: string;
  forcedColors?: true;
}>;

function safeCandidateRoot(): string {
  const frontendRoot = process.cwd();
  const expected = goldenCandidateRoot(frontendRoot);
  if (
    path.dirname(expected) !== path.join(frontendRoot, "test-results") ||
    path.basename(expected) !== "phase5a2-golden-candidates"
  ) {
    throw new Error("[P5A2_GOLDEN] candidate-root-invalid");
  }
  return ensureOwnedDirectory(
    frontendRoot,
    ["test-results", "phase5a2-golden-candidates"],
    "golden-candidate-output-root",
  );
}

export function goldenOutputPath(relativePath: string): string {
  return prepareOwnedFileTarget(safeCandidateRoot(), relativePath, "golden-candidate-output");
}

export function installGoldenRuntimeHooks(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", () => errors.push("pageerror"));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push("console-error");
  });
  return errors;
}

interface GoldenScrollProbe {
  revision: number;
  cleanup: () => void;
}

async function waitForGoldenScrollQuiescence(page: Page): Promise<boolean> {
  return page.evaluate(
    ({ quietFramesRequired, timeoutMs }) => new Promise<boolean>((resolve) => {
      const browserGlobal = globalThis as typeof globalThis & {
        __phase5a2GoldenScrollProbe?: GoldenScrollProbe;
      };
      const probe = browserGlobal.__phase5a2GoldenScrollProbe;
      if (!probe) {
        resolve(false);
        return;
      }
      let observedRevision = probe.revision;
      let quietFramesObserved = 0;
      let frame = 0;
      const timer = window.setTimeout(() => {
        cancelAnimationFrame(frame);
        resolve(false);
      }, timeoutMs);
      const sample = () => {
        if (probe.revision === observedRevision) quietFramesObserved += 1;
        else {
          observedRevision = probe.revision;
          quietFramesObserved = 0;
        }
        if (quietFramesObserved >= quietFramesRequired) {
          clearTimeout(timer);
          resolve(true);
          return;
        }
        frame = requestAnimationFrame(sample);
      };
      frame = requestAnimationFrame(sample);
    }),
    {
      quietFramesRequired: CATALOG_SCROLL_QUIET_FRAMES_REQUIRED,
      timeoutMs: CATALOG_SCROLL_QUIESCENCE_TIMEOUT_MS,
    },
  );
}

export async function prepareGoldenAnchoredTarget(
  page: Page,
  target: Locator,
): Promise<void> {
  await page.evaluate(() => {
    const browserGlobal = globalThis as typeof globalThis & {
      __phase5a2GoldenScrollProbe?: GoldenScrollProbe;
    };
    browserGlobal.__phase5a2GoldenScrollProbe?.cleanup();
    const probe: GoldenScrollProbe = { revision: 0, cleanup: () => undefined };
    const observeScroll = () => { probe.revision += 1; };
    probe.cleanup = () => document.removeEventListener("scroll", observeScroll, true);
    document.addEventListener("scroll", observeScroll, true);
    browserGlobal.__phase5a2GoldenScrollProbe = probe;
  });
  try {
    await target.scrollIntoViewIfNeeded();
    if (!await waitForGoldenScrollQuiescence(page)) {
      throw new Error("[P5A2_GOLDEN] scroll-quiescence-invalid");
    }
    const focused = await target.evaluate((element) => {
      if (!(element instanceof HTMLElement)) return false;
      element.focus({ preventScroll: true });
      return element.ownerDocument.activeElement === element;
    });
    if (!focused || !await waitForGoldenScrollQuiescence(page)) {
      throw new Error("[P5A2_GOLDEN] anchored-focus-invalid");
    }
  } finally {
    await page.evaluate(() => {
      const browserGlobal = globalThis as typeof globalThis & {
        __phase5a2GoldenScrollProbe?: GoldenScrollProbe;
      };
      browserGlobal.__phase5a2GoldenScrollProbe?.cleanup();
      delete browserGlobal.__phase5a2GoldenScrollProbe;
    });
  }
}

export async function openGoldenCapture(page: Page, capture: GoldenPageCapture): Promise<void> {
  await page.setViewportSize({ width: capture.width, height: capture.height });
  await page.emulateMedia({
    colorScheme: capture.theme,
    forcedColors: capture.forcedColors ? "active" : "none",
    reducedMotion: capture.motion === "reduced" ? "reduce" : "no-preference",
  });
  const response = await page.goto(goldenRoute(capture), { waitUntil: "domcontentloaded" });
  if (!response?.ok()) {
    throw new Error(`[P5A2_GOLDEN] route-status-${response?.status() ?? "missing"}`);
  }
  const root = page.locator(`[data-golden-reference="${capture.reference}"]`);
  await root.waitFor({ state: "attached" });
  if ((await root.getAttribute("data-golden-ready")) !== "true") {
    throw new Error("[P5A2_GOLDEN] route-ready-invalid");
  }
  if ((await root.getAttribute("data-golden-state")) !== capture.state) {
    throw new Error("[P5A2_GOLDEN] route-state-invalid");
  }
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-golden-client]")].every(
      (element) => element.getAttribute("data-golden-client-ready") === "true",
    ),
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    scrollTo(0, 0);
    const animations = document.documentElement.getAnimations({ subtree: true });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  const overlay = page.locator(
    "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
  );
  if ((await overlay.count()) > 0) throw new Error("[P5A2_GOLDEN] framework-overlay-present");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 1) throw new Error("[P5A2_GOLDEN] horizontal-overflow");
}

export async function openGoldenBoard(
  page: Page,
  board: string,
  theme: "light" | "dark" = "light",
): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  const response = await page.goto(`/dev/phase5a2/golden-assets/${board}?theme=${theme}`, {
    waitUntil: "domcontentloaded",
  });
  if (!response?.ok()) throw new Error("[P5A2_GOLDEN] board-route-invalid");
  await page.locator(`[data-golden-asset-board="${board}"]`).waitFor({ state: "attached" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

export async function assertGoldenAxe(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations
    .filter(({ impact }) => impact === "critical" || impact === "serious")
    .map(({ id }) => id)
    .sort();
  if (blocking.length > 0) throw new Error(`[P5A2_GOLDEN_AXE] ${blocking.join(",")}`);
}

export function assertGoldenFileBound(filename: string, kind: "png" | "video"): void {
  const bytes = statSync(filename).size;
  const maximum = kind === "png" ? GOLDEN_MAX_PNG_BYTES : GOLDEN_MAX_VIDEO_BYTES;
  if (bytes <= 0 || bytes > maximum) {
    throw new Error(`[P5A2_GOLDEN] ${kind}-size-invalid`);
  }
}

async function frameHasVisualContent(data: Buffer): Promise<boolean> {
  try {
    const { channels } = await sharp(data, { failOn: "error" }).stats();
    return channels.slice(0, 3).some(({ min, max }) => min !== max);
  } catch {
    return false;
  }
}

export interface GoldenRecording {
  readonly filename: string;
  stop(): Promise<void>;
}

type GoldenMotionCapture = (typeof GOLDEN_MOTION_RECORDINGS)[number];

export async function startGoldenRecording(
  page: Page,
  capture: GoldenMotionCapture,
): Promise<GoldenRecording> {
  const filename = goldenOutputPath(motionRecordingRelativePath(capture));
  let settled = false;
  let validationStarted = false;
  let resolveFrame: (() => void) | undefined;
  let rejectFrame: ((error: Error) => void) | undefined;
  const firstFrame = new Promise<void>((resolve, reject) => {
    resolveFrame = resolve;
    rejectFrame = reject;
  });

  await page.screencast.start({
    path: filename,
    size: { width: capture.width, height: capture.height },
    onFrame: async ({ data, viewportWidth, viewportHeight }) => {
      if (settled || validationStarted) return;
      validationStarted = true;
      if (
        data.length < 2 ||
        data[0] !== 0xff ||
        data[1] !== 0xd8 ||
        viewportWidth !== capture.width ||
        viewportHeight !== capture.height
      ) {
        settled = true;
        rejectFrame?.(new Error("[P5A2_GOLDEN] recording-first-frame-invalid"));
        return;
      }
      const visual = await frameHasVisualContent(data);
      if (settled) return;
      settled = true;
      if (!visual) rejectFrame?.(new Error("[P5A2_GOLDEN] recording-first-frame-uniform"));
      else resolveFrame?.();
    },
  });

  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    rejectFrame?.(new Error("[P5A2_GOLDEN] recording-first-frame-timeout"));
  }, GOLDEN_VIDEO_FIRST_FRAME_TIMEOUT_MS);
  try {
    await firstFrame;
  } catch (error) {
    try { await page.screencast.stop(); } catch { /* teardown owns final cleanup */ }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  let stopped = false;
  return Object.freeze({
    filename,
    async stop() {
      if (stopped) throw new Error("[P5A2_GOLDEN] recording-already-stopped");
      stopped = true;
      await page.screencast.stop();
      assertGoldenFileBound(filename, "video");
    },
  });
}
