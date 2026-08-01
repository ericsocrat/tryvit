import { test } from "./fixtures/safe-test";

test("records an asynchronous route violation in mandatory teardown", async ({
  page,
}) => {
  // Keep the initial about:blank document so application CSP cannot block the
  // synthetic request before Playwright's context route observes it.
  await page.evaluate(async () => {
    const syntheticHost = ["synthetic-auto-fixture", "supabase", "co"].join(
      ".",
    );
    await fetch(`http://${syntheticHost}/rest/v1/products`).catch(
      () => undefined,
    );
  });
  // The body intentionally succeeds. The auto fixture must fail this test in
  // teardown from its context-owned redacted egress audit.
});
