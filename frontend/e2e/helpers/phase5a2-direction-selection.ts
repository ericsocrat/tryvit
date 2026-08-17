import { statSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";

import {
  DIRECTION_SELECTION_MAX_PNG_BYTES,
  DIRECTION_SELECTION_MAX_VIDEO_BYTES,
  DIRECTION_SELECTION_VIDEO_STATE_DWELL_MS,
  directionSelectionRoute,
  getDirectionSelectionCandidateRoot,
  type DirectionSelectionCandidate,
  type DirectionSelectionStill,
  type DirectionSelectionVideo,
} from "@/../tooling/design-system/direction-selection/capture-contract";
import {
  ensureOwnedDirectory,
  prepareOwnedFileTarget,
} from "@/../tooling/design-system/direction-selection/evidence-safety";

function safeCandidateRoot(): string {
  const frontendRoot = process.cwd();
  const expected = getDirectionSelectionCandidateRoot(frontendRoot);
  if (
    path.dirname(expected) !== path.join(frontendRoot, "test-results") ||
    path.basename(expected) !== "phase5a2-direction-selection-candidates"
  ) {
    throw new Error("[P5A2_EVIDENCE] candidate-root-invalid");
  }
  return ensureOwnedDirectory(
    frontendRoot,
    ["test-results", "phase5a2-direction-selection-candidates"],
    "candidate-output-root",
  );
}

export function candidateOutputPath(relativePath: string): string {
  return prepareOwnedFileTarget(
    safeCandidateRoot(),
    relativePath,
    "candidate-output",
  );
}

export function installSanitizedRuntimeHooks(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", () => errors.push("pageerror"));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push("console-error");
  });
  return errors;
}

export async function openDirectionSelectionStudy(
  page: Page,
  candidate: DirectionSelectionCandidate,
  study: DirectionSelectionStill | DirectionSelectionVideo,
): Promise<void> {
  await page.setViewportSize({ width: study.width, height: study.height });
  await page.emulateMedia({
    colorScheme: study.theme,
    reducedMotion: study.motion === "reduced" ? "reduce" : "no-preference",
  });
  const response = await page.goto(directionSelectionRoute(candidate, study), {
    waitUntil: "domcontentloaded",
  });
  if (!response?.ok()) {
    throw new Error(`[P5A2_EVIDENCE] route-status-${response?.status() ?? "missing"}`);
  }
  const root = page.locator(
    `[data-phase5a2-candidate="${candidate}"][data-phase5a2-surface="${study.surface}"]`,
  );
  await root.waitFor({ state: "attached" });
  if ((await root.getAttribute("data-phase5a2-state")) !== study.state) {
    throw new Error("[P5A2_EVIDENCE] route-state-invalid");
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    scrollTo(0, 0);
  });
  const overlay = page.locator(
    "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
  );
  if ((await overlay.count()) > 0) {
    throw new Error("[P5A2_EVIDENCE] framework-overlay-present");
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 1) throw new Error("[P5A2_EVIDENCE] horizontal-overflow");
}

export async function assertDirectionSelectionAxe(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const blockingRuleIds = results.violations
    .filter(({ impact }) => impact === "critical" || impact === "serious")
    .map(({ id }) => id)
    .sort();
  if (blockingRuleIds.length > 0) {
    throw new Error(`[P5A2_AXE] ${blockingRuleIds.join(",")}`);
  }
}

export async function holdDirectionSelectionVideoState(page: Page): Promise<void> {
  await page.waitForTimeout(DIRECTION_SELECTION_VIDEO_STATE_DWELL_MS);
}

export async function settleDirectionSelectionMotionSurface(study: Locator): Promise<number> {
  const animationCount = await study.evaluate(async (element) => {
    const surface = element.parentElement;
    if (!surface) return -1;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const animations = surface.getAnimations({ subtree: true }).filter((animation) => {
      const endTime = Number(animation.effect?.getComputedTiming().endTime ?? 0);
      return Number.isFinite(endTime) && endTime > 0 && animation.playState !== "finished";
    });
    await Promise.all(
      animations.map(async (animation) => animation.finished.catch(() => undefined)),
    );
    return animations.length;
  });
  if (animationCount < 1) {
    throw new Error("[P5A2_EVIDENCE] full-motion-animation-missing");
  }
  await holdDirectionSelectionVideoState(study.page());
  return animationCount;
}

export function assertCandidateFileBound(filename: string, kind: "png" | "video"): void {
  const bytes = statSync(filename).size;
  const maximum = kind === "png"
    ? DIRECTION_SELECTION_MAX_PNG_BYTES
    : DIRECTION_SELECTION_MAX_VIDEO_BYTES;
  if (bytes <= 0 || bytes > maximum) {
    throw new Error(`[P5A2_EVIDENCE] ${kind}-size-invalid`);
  }
}
