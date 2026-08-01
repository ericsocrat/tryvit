// ─── Playwright auth setup project ──────────────────────────────────────────
// Creates a test user via Supabase Admin API, logs in through the UI, completes
// onboarding, and saves browser storageState for downstream test projects.
//
// Registered only in explicit local-authenticated safety mode.

import path from "node:path";

import { expect, test as setup } from "./fixtures/safe-test";
import {
  TEST_EMAIL,
  TEST_PASSWORD,
  ensureTestUser,
} from "./helpers/test-user";
import {
  discoverLocalSupabaseOrigin,
  loadSafetyContractFromEnvironment,
} from "./helpers/visual-safety";

const authStateDirectory = process.env.VISUAL_SAFETY_AUTH_STATE_DIR;
if (!authStateDirectory || !path.isAbsolute(authStateDirectory)) {
  throw new Error("[VS_AUTH_STATE_DIR] owned-temporary-directory-required");
}
const AUTH_STATE_PATH = path.join(authStateDirectory, "user.json");
const safetyContract = loadSafetyContractFromEnvironment(process.env);

setup("create user and authenticate via UI", async ({ page }) => {
  // Auth flow involves a network round-trip to Supabase (user creation +
  // login + redirect). In CI the latency can spike, so give this setup
  // test a generous 60 s budget (default per-test timeout is 30 s).
  setup.setTimeout(60_000);

  // ── 1. Provision test user ────────────────────────────────────────────────
  await ensureTestUser();

  // ── 2. Login via the UI ───────────────────────────────────────────────────
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);

  // Keep authentication failures diagnosable without ever recording a token,
  // credential, response body, or hosted endpoint.  A local authenticated run
  // must prove that the browser received a successful password-grant response
  // before we interpret a missing redirect as a cookie/middleware problem.
  if (safetyContract.mode !== "local-authenticated") {
    throw new Error(`[VS_AUTH] mode-${safetyContract.mode}`);
  }
  const expectedSupabaseOrigin = (
    await discoverLocalSupabaseOrigin(
      path.resolve(process.cwd(), "..", "supabase", "config.toml"),
    )
  ).origin;
  const observedAuthTraffic: string[] = [];
  const recordLoopbackAuthTraffic = (
    method: string,
    rawUrl: string,
    status?: number,
  ) => {
    try {
      const url = new URL(rawUrl);
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/auth/")
      ) {
        return;
      }
      observedAuthTraffic.push(
        `${method} ${url.pathname}${status === undefined ? "" : ` ${status}`}`,
      );
      if (observedAuthTraffic.length > 12) observedAuthTraffic.shift();
    } catch {
      // Ignore malformed/non-loopback URLs; the browser safety fixture owns
      // the authoritative egress assertion.
    }
  };
  page.on("request", (request) => {
    recordLoopbackAuthTraffic(request.method(), request.url());
  });
  page.on("response", (response) => {
    recordLoopbackAuthTraffic(
      response.request().method(),
      response.url(),
      response.status(),
    );
  });
  const authTokenResponse = page.waitForResponse(
    (response) => {
      try {
        const url = new URL(response.url());
        return (
          response.request().method() === "POST" &&
          url.origin === expectedSupabaseOrigin &&
          url.pathname === "/auth/v1/token"
        );
      } catch {
        return false;
      }
    },
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: "Sign In" }).click();
  let tokenResponse: Awaited<typeof authTokenResponse>;
  try {
    tokenResponse = await authTokenResponse;
  } catch {
    throw new Error(
      `[VS_AUTH] token-response-timeout:${observedAuthTraffic.join(",") || "none"}`,
    );
  }
  if (!tokenResponse.ok()) {
    throw new Error(`[VS_AUTH] token-status-${tokenResponse.status()}`);
  }

  // After login the user is already onboarded (ensureTestUser pre-creates
  // preferences with onboarding_skipped=true), so we should land on /app/search.
  // If somehow onboarding still appears, complete it.
  // Explicit timeout overrides the global navigationTimeout (15 s) which is
  // too tight for Supabase auth redirects under CI load.
  await page.waitForURL(/\/(app\/search|onboarding)/, { timeout: 45_000 });

  // ── 3. Complete onboarding (if needed) ────────────────────────────────────
  if (page.url().includes("/onboarding")) {
    // Click "Skip — go to app" on the Welcome step
    await page.getByTestId("onboarding-skip-all").click();

    // Should land on /app/search
    await page.waitForURL(/\/app\/search/, { timeout: 10_000 });
  }

  // ── 4. Verify we're authenticated on the app page ────────────────────────
  await expect(page).toHaveURL(/\/app\/search/);

  // ── 5. Persist auth cookies for dependent test projects ───────────────────
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
