import { expect, test } from "./fixtures/safe-test";
import {
  assertCandidateFileBound,
  assertDirectionSelectionAxe,
  candidateOutputPath,
  holdDirectionSelectionVideoState,
  installSanitizedRuntimeHooks,
  openDirectionSelectionStudy,
} from "./helpers/phase5a2-direction-selection";
import {
  DIRECTION_SELECTION_VIDEOS,
  videoRelativePath,
} from "@/../tooling/design-system/direction-selection/capture-contract";

for (const capture of DIRECTION_SELECTION_VIDEOS.filter(
  ({ kind }) => kind === "scanner-sequence",
)) {
  test(`records ${capture.candidate} scanner state sequence`, async ({ page }) => {
    const runtimeErrors = installSanitizedRuntimeHooks(page);
    await openDirectionSelectionStudy(page, capture.candidate, capture);
    await assertDirectionSelectionAxe(page);

    const study = page.locator("[data-phase5a2-scanner]");
    await expect(study).toHaveAttribute("data-phase5a2-state", "ready");
    await holdDirectionSelectionVideoState(page);
    await study.locator("button").first().click();
    await expect(study).toHaveAttribute("data-phase5a2-state", "recognized");
    await holdDirectionSelectionVideoState(page);
    await study.locator("button").first().click();
    await expect(study).toHaveAttribute("data-phase5a2-state", "processing");
    await holdDirectionSelectionVideoState(page);
    await expect(study).toHaveAttribute("data-phase5a2-state", "matched", {
      timeout: 2_000,
    });
    await holdDirectionSelectionVideoState(page);
    await study.locator("button").first().click();
    await expect(study).toHaveAttribute("data-phase5a2-state", "ready");
    await holdDirectionSelectionVideoState(page);
    expect(runtimeErrors).toEqual([]);

    const video = page.video();
    if (!video) throw new Error("[P5A2_EVIDENCE] scanner-video-missing");
    const filename = candidateOutputPath(videoRelativePath(capture));
    await page.close();
    await video.saveAs(filename);
    assertCandidateFileBound(filename, "video");
  });
}
