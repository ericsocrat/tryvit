import { test } from "./fixtures/safe-test";
import { assertPhase5VisualBaseline } from "./helpers/visual";
// Node's type-stripping loader requires the source extension at runtime.
// prettier-ignore
// @ts-expect-error TS5097: executed through the guarded Playwright launcher.
import { VISUAL_BASELINE_CASES } from "../tooling/phase5a0d-contract.ts";

test.describe.configure({ mode: "serial", retries: 0 });

for (const baseline of VISUAL_BASELINE_CASES.filter((candidate) => candidate.mode === "public")) {
  test.describe(baseline.id, () => {
    test.use({
      viewport: { width: baseline.width, height: baseline.height },
      deviceScaleFactor: 1,
      locale: "en-US",
      timezoneId: "UTC",
      colorScheme: "light",
      contextOptions: { reducedMotion: "reduce" },
    });

    test("matches the authoritative public baseline", async ({ page }) => {
      await assertPhase5VisualBaseline(page, baseline);
    });
  });
}
