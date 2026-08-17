import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "./fixtures/safe-test";
import {
  assertCandidateFileBound,
  assertDirectionSelectionAxe,
  candidateOutputPath,
  installSanitizedRuntimeHooks,
  openDirectionSelectionStudy,
} from "./helpers/phase5a2-direction-selection";
import {
  DIRECTION_SELECTION_STILLS,
  stillRelativePath,
} from "@/../tooling/design-system/direction-selection/capture-contract";
import { PHASE5A2_FIXTURE_SHA256 } from "@/app/dev/phase5a2/_shared/fixture";

test("captures the bounded direction-selection still matrix", async ({ browser, page }) => {
  test.setTimeout(180_000);
  const runtimeErrors = installSanitizedRuntimeHooks(page);

  for (const capture of DIRECTION_SELECTION_STILLS) {
    await openDirectionSelectionStudy(page, capture.candidate, capture);
    await assertDirectionSelectionAxe(page);
    const filename = candidateOutputPath(stillRelativePath(capture));
    await page.screenshot({
      animations: "disabled",
      caret: "hide",
      fullPage: false,
      path: filename,
      scale: "css",
    });
    assertCandidateFileBound(filename, "png");
  }

  expect(runtimeErrors).toEqual([]);
  const sourceSha = process.env.PHASE5A2_DIRECTION_SOURCE_SHA ?? "";
  const sourceTreeSha = process.env.PHASE5A2_DIRECTION_SOURCE_TREE_SHA ?? "";
  if (!/^[0-9a-f]{40}$/u.test(sourceSha) || !/^[0-9a-f]{40}$/u.test(sourceTreeSha)) {
    throw new Error("[P5A2_EVIDENCE] source-provenance-invalid");
  }
  const playwrightPackage = JSON.parse(
    readFileSync(path.join(process.cwd(), "node_modules", "@playwright", "test", "package.json"), "utf8"),
  ) as { readonly version?: unknown };
  if (typeof playwrightPackage.version !== "string") {
    throw new Error("[P5A2_EVIDENCE] playwright-version-invalid");
  }
  writeFileSync(
    candidateOutputPath("runtime.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        kind: "phase5a2-direction-selection-runtime",
        sourceSha,
        sourceTreeSha,
        fixtureSha256: PHASE5A2_FIXTURE_SHA256,
        playwrightVersion: playwrightPackage.version,
        browserName: "chromium",
        browserVersion: browser.version(),
        timezoneId: "UTC",
        browserLocale: "en-US",
        nodeVersion: process.version,
        osPlatform: process.platform,
        osArch: process.arch,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
});
