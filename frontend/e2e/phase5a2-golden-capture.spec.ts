import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "./fixtures/safe-test";
import {
  assertGoldenAxe,
  assertGoldenFileBound,
  goldenOutputPath,
  installGoldenRuntimeHooks,
  openGoldenBoard,
  openGoldenCapture,
} from "./helpers/phase5a2-golden-reference";
import {
  GOLDEN_ASSET_BOARDS,
  GOLDEN_CORE_STILLS,
  GOLDEN_FORCED_COLORS_STILLS,
  GOLDEN_GERMAN_DESKTOP_STILLS,
  GOLDEN_POLISH_MOBILE_STILLS,
  GOLDEN_STATE_CAPTURES,
  assetBoardRelativePath,
  coreStillRelativePath,
  forcedColorsStillRelativePath,
  localizedStillRelativePath,
  stateStillRelativePath,
} from "@/../tooling/design-system/golden-reference/capture-contract";
import { GOLDEN_FIXTURE_CONTRACT_VERSION } from "@/app/dev/phase5a2/_golden/fixture";

async function screenshot(page: Parameters<typeof openGoldenCapture>[0], filename: string) {
  await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    path: filename,
    scale: "css",
  });
  assertGoldenFileBound(filename, "png");
}

test("captures the finite Golden Reference still and board matrix", async ({ browser, page }) => {
  test.setTimeout(900_000);
  const runtimeErrors = installGoldenRuntimeHooks(page);

  for (const capture of GOLDEN_CORE_STILLS) {
    await openGoldenCapture(page, capture);
    await assertGoldenAxe(page);
    await screenshot(page, goldenOutputPath(coreStillRelativePath(capture)));
  }
  for (const capture of [...GOLDEN_POLISH_MOBILE_STILLS, ...GOLDEN_GERMAN_DESKTOP_STILLS]) {
    await openGoldenCapture(page, capture);
    await screenshot(page, goldenOutputPath(localizedStillRelativePath(capture)));
  }
  for (const capture of GOLDEN_FORCED_COLORS_STILLS) {
    await openGoldenCapture(page, capture);
    await screenshot(page, goldenOutputPath(forcedColorsStillRelativePath(capture)));
  }
  for (const capture of GOLDEN_STATE_CAPTURES) {
    await openGoldenCapture(page, capture);
    await screenshot(page, goldenOutputPath(stateStillRelativePath(capture)));
  }
  for (const board of GOLDEN_ASSET_BOARDS) {
    await openGoldenBoard(page, board);
    await assertGoldenAxe(page);
    await screenshot(page, goldenOutputPath(assetBoardRelativePath(board)));
  }

  expect(runtimeErrors).toEqual([]);
  const sourceSha = process.env.PHASE5A2_GOLDEN_SOURCE_SHA ?? "";
  const sourceTreeSha = process.env.PHASE5A2_GOLDEN_SOURCE_TREE_SHA ?? "";
  if (!/^[0-9a-f]{40}$/u.test(sourceSha) || !/^[0-9a-f]{40}$/u.test(sourceTreeSha)) {
    throw new Error("[P5A2_GOLDEN] source-provenance-invalid");
  }
  const playwrightPackage = JSON.parse(
    readFileSync(path.join(process.cwd(), "node_modules", "@playwright", "test", "package.json"), "utf8"),
  ) as { readonly version?: unknown };
  if (typeof playwrightPackage.version !== "string") {
    throw new Error("[P5A2_GOLDEN] playwright-version-invalid");
  }
  writeFileSync(
    goldenOutputPath("runtime.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      kind: "phase5a2-golden-reference-runtime",
      sourceSha,
      sourceTreeSha,
      fixtureContractVersion: GOLDEN_FIXTURE_CONTRACT_VERSION,
      playwrightVersion: playwrightPackage.version,
      browserName: "chromium",
      browserVersion: browser.version(),
      timezoneId: "UTC",
      browserLocale: "en-US",
      nodeVersion: process.version,
      osPlatform: process.platform,
      osArch: process.arch,
    }, null, 2)}\n`,
    "utf8",
  );
});
