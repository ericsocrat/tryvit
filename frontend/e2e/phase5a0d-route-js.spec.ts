import { execFileSync } from "node:child_process";
import path from "node:path";

import { test, visualSafetyMode } from "./fixtures/safe-test";
import { loadSafetyContractFromEnvironment } from "./helpers/visual-safety";
// Node's type-stripping loader requires the source extension at runtime.
// prettier-ignore
// @ts-expect-error TS5097: executed through the guarded Playwright launcher.
import { MEASUREMENT_ROUTES } from "../tooling/phase5a0d-contract.ts";
// prettier-ignore
// @ts-expect-error TS5097: executed through the guarded Playwright launcher.
import { captureRouteJavaScript, resetRouteJsCaptureDirectory } from "../tooling/phase5a0d-route-js.ts";

const safetyContract = loadSafetyContractFromEnvironment(process.env);
const frontendRoot = path.resolve(process.cwd());
const captureRoot = path.join(frontendRoot, "performance-reports", "route-js-captures");
const mode = visualSafetyMode === "public" ? "public" : "local-authenticated";
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: frontendRoot,
  encoding: "utf8",
  windowsHide: true,
}).trim();

if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) {
  throw new Error("[P5_BUNDLE] source-commit-invalid");
}

test.describe.configure({ mode: "serial", retries: 0 });

test.beforeAll(() => {
  resetRouteJsCaptureDirectory(captureRoot, mode);
});

for (const route of MEASUREMENT_ROUTES) {
  const routeMode = route.requiresLocalFixture ? "local-authenticated" : "public";

  test(`cold JavaScript inventory: ${route.id}`, async ({ page }) => {
    test.skip(routeMode !== mode, `route belongs to ${routeMode} mode`);

    await captureRouteJavaScript({
      page,
      frontendRoot,
      captureRoot,
      mode,
      routeId: route.id,
      fixtureProductId: process.env.QA_PRODUCT_ID,
      appOrigin: safetyContract.appOrigin,
      sourceCommit,
    });
  });
}
