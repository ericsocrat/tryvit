import {
  expect,
  test as base,
  type Page,
  type TestInfo,
} from "@playwright/test";

// The fixture lives below e2e/ so every spec can use one stable import path.
// eslint-disable-next-line no-restricted-imports
import {
  assertNoEgressViolations,
  createEgressAudit,
  installBrowserEgressGuards,
  loadSafetyContractFromEnvironment,
} from "../helpers/visual-safety";

/**
 * Load and validate the explicit safety mode while the test module is loaded.
 * Server/build launchers perform their own earlier preflight; this second check
 * guarantees that no Playwright browser or context can be created without the
 * same fail-closed contract.
 */
const visualSafetyContract = loadSafetyContractFromEnvironment(process.env);

export const visualSafetyMode = visualSafetyContract.mode;

type SafetyFixtures = {
  safetyEgressAudit: void;
};

/**
 * Automatic fixtures are initialized before ordinary test fixtures. Depending
 * only on Playwright's built-in `context` therefore installs both HTTP and
 * WebSocket routing before the built-in `page` fixture can call `newPage()`.
 * Keeping the built-in context factory also preserves device descriptors,
 * storage state, baseURL, tracing, video, and Playwright-owned cleanup.
 */
export const test = base.extend<SafetyFixtures>({
  serviceWorkers: "block",
  safetyEgressAudit: [
    async ({ context }, run) => {
      const audit = createEgressAudit();

      try {
        await installBrowserEgressGuards(
          context,
          visualSafetyContract,
          audit,
        );
        await run();
      } finally {
        // This assertion runs during mandatory fixture teardown even if the
        // test body failed. Playwright then closes its own page/context.
        await assertNoEgressViolations(audit);
      }
    },
    { auto: true },
  ],
});

export { expect };
export type { Page, TestInfo };
