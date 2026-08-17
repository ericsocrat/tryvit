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
    const initialStage = await study.getAttribute("data-phase5a2-motion-stage");
    if (!initialStage) throw new Error("[P5A2_EVIDENCE] motion-stage-missing");
    await holdDirectionSelectionVideoState(page);

    let previousStage = initialStage;
    for (let index = 0; index < 3; index += 1) {
      await next.click();
      await expect(study).not.toHaveAttribute("data-phase5a2-motion-stage", previousStage);
      previousStage = (await study.getAttribute("data-phase5a2-motion-stage")) ?? "";
      await settleDirectionSelectionMotionSurface(study);
    }
    await restart.click();
    await expect(study).toHaveAttribute("data-phase5a2-motion-stage", initialStage);
    await settleDirectionSelectionMotionSurface(study);
    expect(runtimeErrors).toEqual([]);

    const video = page.video();
    if (!video) throw new Error("[P5A2_EVIDENCE] motion-video-missing");
    const filename = candidateOutputPath(videoRelativePath(capture));
    await page.close();
    await video.saveAs(filename);
    assertCandidateFileBound(filename, "video");
  });
}
