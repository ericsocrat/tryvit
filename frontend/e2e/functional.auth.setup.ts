// ─── Playwright functional auth setup ─────────────────────────────────────
// Uses a dedicated user and storage state so functional tests do not share
// auth tokens with the authenticated project.

import { expect, test as setup } from "@playwright/test";
import {
    ensureScopedTestUser,
    getScopedTestCredentials,
} from "./helpers/test-user";

const AUTH_STATE_PATH = "e2e/.auth/functional-user.json";

setup("create functional user and authenticate via UI", async ({ page }) => {
  setup.setTimeout(60_000);

  await ensureScopedTestUser("functional");
  const { email, password } = getScopedTestCredentials("functional");

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForURL(/\/(app\/search|onboarding)/, { timeout: 45_000 });

  if (page.url().includes("/onboarding")) {
    await page.getByTestId("onboarding-skip-all").click();
    await page.waitForURL(/\/app\/search/, { timeout: 10_000 });
  }

  await expect(page).toHaveURL(/\/app\/search/);
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
