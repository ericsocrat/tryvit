import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/safe-test";
import {
  assertCandidateFileBound,
  assertDirectionSelectionAxe,
  candidateOutputPath,
  holdDirectionSelectionVideoState,
  installSanitizedRuntimeHooks,
  openDirectionSelectionStudy,
  settleDirectionSelectionMotionSurface,
} from "./helpers/phase5a2-direction-selection";
import {
  DIRECTION_SELECTION_VIDEOS,
  videoRelativePath,
} from "@/../tooling/design-system/direction-selection/capture-contract";

type ViewportPosition = Readonly<{ x: number; y: number }>;

async function viewportPosition(page: Page): Promise<ViewportPosition> {
  return page.evaluate(() => ({ x: scrollX, y: scrollY }));
}

async function activateMotionControl(page: Page, control: Locator): Promise<void> {
  const focused = await control.evaluate((element) => {
    if (!(element instanceof HTMLButtonElement)) return false;
    element.focus({ preventScroll: true });
    return document.activeElement === element;
  });
  if (!focused) throw new Error("[P5A2_EVIDENCE] motion-control-focus-failed");
  await page.keyboard.press("Enter");
}

async function assertMotionViewportStable(
  page: Page,
  expected: ViewportPosition,
): Promise<void> {
  const actual = await viewportPosition(page);
  if (actual.x !== expected.x || actual.y !== expected.y) {
    throw new Error("[P5A2_EVIDENCE] motion-viewport-shift");
  }
}

for (const capture of DIRECTION_SELECTION_VIDEOS.filter(
  ({ kind }) => kind === "motion-sequence",
)) {
  test(`records ${capture.candidate} motion depth sequence`, async ({ page }) => {
    const runtimeErrors = installSanitizedRuntimeHooks(page);
    await openDirectionSelectionStudy(page, capture.candidate, capture);
    await assertDirectionSelectionAxe(page);

    const study = page.locator("[data-phase5a2-motion-stage]");
    const next = study.locator(".phase5a2-motion-actions button").nth(1);
    const restart = study.locator(".phase5a2-motion-actions button").nth(2);
    await expect(study.locator(".phase5a2-motion-actions")).toBeInViewport({ ratio: 1 });
    const initialStage = await study.getAttribute("data-phase5a2-motion-stage");
    if (!initialStage) throw new Error("[P5A2_EVIDENCE] motion-stage-missing");
    const initialViewport = await viewportPosition(page);
    await holdDirectionSelectionVideoState(page);

    let previousStage = initialStage;
    for (let index = 0; index < 3; index += 1) {
      await activateMotionControl(page, next);
      await expect(study).not.toHaveAttribute("data-phase5a2-motion-stage", previousStage);
      previousStage = (await study.getAttribute("data-phase5a2-motion-stage")) ?? "";
      await settleDirectionSelectionMotionSurface(study);
      await assertMotionViewportStable(page, initialViewport);
    }
    await activateMotionControl(page, restart);
    await expect(study).toHaveAttribute("data-phase5a2-motion-stage", initialStage);
    await settleDirectionSelectionMotionSurface(study);
    await assertMotionViewportStable(page, initialViewport);
    expect(runtimeErrors).toEqual([]);

    const video = page.video();
    if (!video) throw new Error("[P5A2_EVIDENCE] motion-video-missing");
    const filename = candidateOutputPath(videoRelativePath(capture));
    await page.close();
    await video.saveAs(filename);
    assertCandidateFileBound(filename, "video");
  });
}
