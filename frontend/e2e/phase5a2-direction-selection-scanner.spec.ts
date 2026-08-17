import { expect, test } from "./fixtures/safe-test";
import {
  assertDirectionSelectionAxe,
  holdDirectionSelectionVideoState,
  installSanitizedRuntimeHooks,
  openDirectionSelectionStudy,
  startDirectionSelectionRecording,
} from "./helpers/phase5a2-direction-selection";
import { DIRECTION_SELECTION_VIDEOS } from "@/../tooling/design-system/direction-selection/capture-contract";

for (const capture of DIRECTION_SELECTION_VIDEOS.filter(
  ({ kind }) => kind === "scanner-sequence",
)) {
  test(`records ${capture.candidate} scanner state sequence`, async ({ page }) => {
    const runtimeErrors = installSanitizedRuntimeHooks(page);
    await openDirectionSelectionStudy(page, capture.candidate, capture);
    await assertDirectionSelectionAxe(page);

    const study = page.locator("[data-phase5a2-scanner]");
    await expect(study).toHaveAttribute("data-phase5a2-state", "ready");
    const recording = await startDirectionSelectionRecording(page, capture);
    let sequenceError: unknown;
    try {
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
    } catch (error) {
      sequenceError = error;
      throw error;
    } finally {
      try {
        await recording.stop();
      } catch (stopError) {
        if (sequenceError === undefined) throw stopError;
      }
    }
  });
}
