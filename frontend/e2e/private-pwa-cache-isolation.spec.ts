import { createHash } from "node:crypto";
import path from "node:path";

import type { BrowserContext, Page } from "@playwright/test";

import { expect, test } from "./fixtures/safe-test";
import {
  getScopedTestSession,
  TEST_EMAIL,
  TEST_PASSWORD,
  type ScopedTestSession,
} from "./helpers/test-user";
import { VisualSafetyError, loadSafetyContractFromEnvironment } from "./helpers/visual-safety";

// The shared safe fixture blocks workers by default. This one audited proof is
// the sole file-level override and still installs its egress guards first.
test.use({ serviceWorkers: "allow" });

const safetyContract = loadSafetyContractFromEnvironment(process.env);
if (safetyContract.mode !== "local-authenticated") {
  throw new VisualSafetyError("VS_PWA_MODE", "private-cache.local-only");
}

const authStateDirectory = process.env.VISUAL_SAFETY_AUTH_STATE_DIR;
if (!authStateDirectory || !path.isAbsolute(authStateDirectory)) {
  throw new VisualSafetyError("VS_AUTH_STATE_DIR", "owned-temporary-directory-required");
}

const APP_PRIVATE_HTML_PATH = "/app/settings?phase5a0f=private-cache-isolation";
const APP_PRIVATE_RSC_PATH = "/app/settings/account";
const AUTH_USER_URL = new URL("/auth/v1/user", safetyContract.supabaseOrigin).toString();
const USER_PREFERENCES_URL = new URL(
  "/rest/v1/user_preferences?select=user_id%2Ccountry%2Cpreferred_language&limit=1",
  safetyContract.supabaseOrigin,
).toString();
const LEGACY_PRIVATE_CACHE_NAMES = [
  "apis",
  "cross-origin",
  "next-data",
  "others",
  "pages",
  "pages-rsc",
  "pages-rsc-prefetch",
  "product-api-v3",
  "static-data-assets",
] as const;
const UNRELATED_SENTINEL_CACHE = "static-image-assets";
const UNRELATED_SENTINEL_PATH = "/phase5a0f-unrelated-sentinel.txt";
const WORKER_ACTIVATION_TIMEOUT_MS = 20_000;
const WORKER_CONTROL_TIMEOUT_MS = 15_000;
const CLEANUP_TIMEOUT_MS = 20_000;
const SIGN_OUT_NAME = /^(?:sign out|wyloguj się|abmelden)$/i;
const SIGN_IN_NAME = /^(?:sign in|zaloguj się|anmelden)$/i;
const EMAIL_NAME = /^(?:email|e-mail)$/i;
const PASSWORD_NAME = /^(?:password|hasło|passwort)$/i;

type IdentityKind = "auth-user" | "preferences" | "none";
type BrowserProbeResult =
  | Readonly<{
      kind: "rejected";
    }>
  | Readonly<{
      identityMatches: boolean;
      kind: "response";
      ok: boolean;
    }>;

type SafeRequestHeaders = Readonly<Record<string, string>>;
type ProbeFailureCodes = Readonly<{
  identityMismatch: string;
  nonSuccess: string;
  rejected: string;
}>;

function fail(code: string): never {
  throw new Error(`[PWA_CACHE_ISOLATION] ${code}`);
}

function responseDigest(responseBody: Buffer): string {
  return createHash("sha256").update(responseBody).digest("hex");
}

function assertSuccessfulIdentityProbe(result: BrowserProbeResult, codes: ProbeFailureCodes): void {
  if (result.kind === "rejected") fail(codes.rejected);
  if (!result.ok) fail(codes.nonSuccess);
  if (!result.identityMatches) fail(codes.identityMismatch);
}

function sessionHeaders(session: ScopedTestSession): SafeRequestHeaders {
  return {
    Accept: "application/json",
    apikey: session.anonKey,
    Authorization: `Bearer ${session.accessToken}`,
  };
}

async function runBrowserProbe(
  page: Page,
  request: Readonly<{
    expectedUserId?: string;
    headers?: SafeRequestHeaders;
    identityKind: IdentityKind;
    url: string;
  }>,
): Promise<BrowserProbeResult> {
  return page.evaluate(async (input) => {
    try {
      const response = await fetch(input.url, {
        // Match the installed Supabase SDK's default browser fetch semantics:
        // bearer/apikey headers bind identity; cross-origin cookies are omitted.
        credentials: "same-origin",
        headers: input.headers,
        method: "GET",
      });
      const body = await response.text();
      let identityMatches = input.identityKind === "none";
      try {
        const parsed = JSON.parse(body) as unknown;
        if (
          input.identityKind === "auth-user" &&
          parsed &&
          typeof parsed === "object" &&
          "id" in parsed
        ) {
          identityMatches = (parsed as { id?: unknown }).id === input.expectedUserId;
        } else if (
          input.identityKind === "preferences" &&
          Array.isArray(parsed) &&
          parsed.length === 1
        ) {
          identityMatches = (parsed[0] as { user_id?: unknown }).user_id === input.expectedUserId;
        }
      } catch {
        identityMatches = input.identityKind === "none";
      }

      return {
        identityMatches,
        kind: "response" as const,
        ok: response.ok,
      };
    } catch {
      return { kind: "rejected" as const };
    }
  }, request);
}

async function runObservedOnlineProbe(
  page: Page,
  request: Readonly<{
    expectedUserId: string;
    headers: SafeRequestHeaders;
    identityKind: Exclude<IdentityKind, "none">;
    url: string;
  }>,
): Promise<BrowserProbeResult> {
  const observedResponse = page.waitForResponse(
    (response) => response.request().method() === "GET" && response.url() === request.url,
  );
  const [response, result] = await Promise.all([observedResponse, runBrowserProbe(page, request)]);
  if (!response.fromServiceWorker()) {
    fail("probe-bypassed-service-worker");
  }
  return result;
}

async function assertNoPrivateCacheKeys(page: Page, privateUrls: readonly string[]): Promise<void> {
  const cached = await page.evaluate(async (urls) => {
    const matched = new Array<boolean>(urls.length).fill(false);
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) {
        const index = urls.indexOf(request.url);
        if (index >= 0) matched[index] = true;
      }
    }
    return matched;
  }, privateUrls);
  if (cached.some(Boolean)) fail("private-request-entered-cache-storage");
}

async function registerAndControlWorker(page: Page): Promise<void> {
  await page.goto("/offline", { waitUntil: "domcontentloaded" });
  const cleanStart = await page.evaluate(
    async (migration) => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const cacheNames = await caches.keys();
      if (registrations.length !== 0 || cacheNames.length !== 0) return false;

      for (const [index, cacheName] of migration.legacyCacheNames.entries()) {
        const cache = await caches.open(cacheName);
        await cache.put(
          `/phase5a0f-legacy-sentinel-${index}.txt`,
          new Response("synthetic-private-cache-sentinel"),
        );
      }
      const unrelatedCache = await caches.open(migration.unrelatedCacheName);
      await unrelatedCache.put(
        migration.unrelatedPath,
        new Response("synthetic-unrelated-cache-sentinel"),
      );
      await unrelatedCache.put(
        migration.privateEntryUrl,
        new Response("synthetic-private-cache-sentinel"),
      );
      return true;
    },
    {
      legacyCacheNames: LEGACY_PRIVATE_CACHE_NAMES,
      privateEntryUrl: AUTH_USER_URL,
      unrelatedCacheName: UNRELATED_SENTINEL_CACHE,
      unrelatedPath: UNRELATED_SENTINEL_PATH,
    },
  );
  if (!cleanStart) fail("browser-storage-not-clean-at-start");

  const activationOutcome = await page.evaluate(
    async ({ activationTimeoutMs }) => {
      type ActivationOutcome =
        | "activated"
        | "worker-activation-timeout"
        | "worker-install-redundant"
        | "worker-missing"
        | "worker-register-invalid"
        | "worker-register-rejected"
        | "worker-scope-invalid"
        | "worker-script-invalid";

      const registration: ServiceWorkerRegistration | null | undefined =
        await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
      if (registration === null) return "worker-register-rejected" as const;
      if (registration === undefined) return "worker-register-invalid" as const;
      if (registration.scope !== new URL("/", location.href).href) {
        return "worker-scope-invalid" as const;
      }

      const worker = registration.installing ?? registration.waiting ?? registration.active;
      if (!worker) return "worker-missing" as const;
      if (worker.scriptURL !== new URL("/sw.js", location.href).href) {
        return "worker-script-invalid" as const;
      }
      if (worker.state === "activated") return "activated" as const;
      if (worker.state === "redundant") return "worker-install-redundant" as const;

      return new Promise<ActivationOutcome>((resolve) => {
        let settled = false;
        const finish = (outcome: ActivationOutcome) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          worker.removeEventListener("statechange", handleStateChange);
          resolve(outcome);
        };
        const handleStateChange = () => {
          if (worker.state === "activated") finish("activated");
          if (worker.state === "redundant") finish("worker-install-redundant");
        };
        const timer = window.setTimeout(
          () => finish("worker-activation-timeout"),
          activationTimeoutMs,
        );
        worker.addEventListener("statechange", handleStateChange);
        handleStateChange();
      });
    },
    {
      activationTimeoutMs: WORKER_ACTIVATION_TIMEOUT_MS,
    },
  );
  if (activationOutcome !== "activated") fail(activationOutcome);

  await page.reload({ waitUntil: "domcontentloaded" });
  const exactWorkerControlsPage = await page
    .waitForFunction(
      () =>
        navigator.serviceWorker.controller?.state === "activated" &&
        navigator.serviceWorker.controller.scriptURL === new URL("/sw.js", location.href).href,
      undefined,
      { timeout: WORKER_CONTROL_TIMEOUT_MS },
    )
    .then(() => true)
    .catch(() => false);
  if (!exactWorkerControlsPage) fail("service-worker-control-timeout");
  if (page.context().serviceWorkers().length !== 1) {
    fail("service-worker-control-not-established");
  }

  const migrationPassed = await page.evaluate(
    async (migration) => {
      const cacheNames = await caches.keys();
      const legacyCachesRemoved = migration.legacyCacheNames.every(
        (cacheName) => !cacheNames.includes(cacheName),
      );
      const unrelatedCache = await caches.open(migration.unrelatedCacheName);
      const unrelatedResponse = await unrelatedCache.match(migration.unrelatedPath);
      const privateResponse = await unrelatedCache.match(migration.privateEntryUrl);
      return (
        legacyCachesRemoved &&
        cacheNames.includes(migration.unrelatedCacheName) &&
        (await unrelatedResponse?.text()) === "synthetic-unrelated-cache-sentinel" &&
        privateResponse === undefined
      );
    },
    {
      legacyCacheNames: LEGACY_PRIVATE_CACHE_NAMES,
      privateEntryUrl: AUTH_USER_URL,
      unrelatedCacheName: UNRELATED_SENTINEL_CACHE,
      unrelatedPath: UNRELATED_SENTINEL_PATH,
    },
  );
  if (!migrationPassed) fail("legacy-private-cache-migration-invalid");
}

async function cleanupBrowserPrivateState(context: BrowserContext): Promise<void> {
  let cleanupFailed = false;
  try {
    await context.setOffline(false);
  } catch {
    cleanupFailed = true;
  }

  let page = context.pages().find((candidate) => !candidate.isClosed());
  try {
    if (!page || page.isClosed()) {
      page = await context.newPage();
      await page.goto("/offline", { waitUntil: "domcontentloaded" });
    }
    const result = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const unregisterResults = await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );
      const cacheNames = await caches.keys();
      const deleteResults = await Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName)),
      );
      return {
        cachesCleared: deleteResults.every(Boolean) && (await caches.keys()).length === 0,
        registrationsCleared:
          unregisterResults.every(Boolean) &&
          (await navigator.serviceWorker.getRegistrations()).length === 0,
      };
    });
    if (!result.cachesCleared || !result.registrationsCleared) {
      cleanupFailed = true;
    }
  } catch {
    cleanupFailed = true;
  }

  try {
    await context.setStorageState({ cookies: [], origins: [] });
  } catch {
    cleanupFailed = true;
  }

  if (cleanupFailed) fail("browser-private-state-cleanup-failed");
}

test.describe("private PWA cache account isolation", () => {
  test.afterEach(async ({ context }, testInfo) => {
    testInfo.setTimeout(CLEANUP_TIMEOUT_MS);
    await cleanupBrowserPrivateState(context);
  });

  test("does not replay user A HTML, RSC, Auth, or PostgREST to user B", async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);

    let offline = false;
    try {
      await registerAndControlWorker(page);

      // User A is the dedicated functional fixture so its real global sign-out
      // cannot revoke the authenticated fixture used by companion audit projects.
      const userA = await getScopedTestSession("functional");
      const userB = await getScopedTestSession("authenticated");

      const rscResponsePromise = page.waitForResponse(
        (response) => {
          const request = response.request();
          const target = new URL(response.url());
          return (
            target.pathname === APP_PRIVATE_RSC_PATH &&
            request.method() === "GET" &&
            request.headers().rsc === "1"
          );
        },
        { timeout: 20_000 },
      );

      const htmlResponse = await page.goto(APP_PRIVATE_HTML_PATH, {
        waitUntil: "domcontentloaded",
      });
      if (!htmlResponse?.ok() || !htmlResponse.fromServiceWorker()) {
        fail("private-html-warmup-invalid");
      }
      const userAHtmlDigest = responseDigest(await htmlResponse.body());

      await page.locator(`a[href="${APP_PRIVATE_RSC_PATH}"]`).first().click();
      const rscResponse = await rscResponsePromise;
      if (!rscResponse.ok() || !rscResponse.fromServiceWorker()) {
        fail("private-rsc-warmup-invalid");
      }

      const rscRequestHeaders = rscResponse.request().headers();
      const replayRscHeaders: Record<string, string> = {};
      for (const name of [
        "accept",
        "next-router-prefetch",
        "next-router-state-tree",
        "next-url",
        "rsc",
      ]) {
        const value = rscRequestHeaders[name];
        if (value) replayRscHeaders[name] = value;
      }
      if (replayRscHeaders.rsc !== "1") fail("private-rsc-headers-invalid");
      const rscUrl = rscResponse.url();

      const userAAuth = await runObservedOnlineProbe(page, {
        expectedUserId: userA.userId,
        headers: sessionHeaders(userA),
        identityKind: "auth-user",
        url: AUTH_USER_URL,
      });
      assertSuccessfulIdentityProbe(userAAuth, {
        identityMismatch: "user-a-auth-identity-mismatch",
        nonSuccess: "user-a-auth-non-success",
        rejected: "user-a-auth-request-rejected",
      });

      const userAPreferences = await runObservedOnlineProbe(page, {
        expectedUserId: userA.userId,
        headers: sessionHeaders(userA),
        identityKind: "preferences",
        url: USER_PREFERENCES_URL,
      });
      assertSuccessfulIdentityProbe(userAPreferences, {
        identityMismatch: "user-a-postgrest-identity-mismatch",
        nonSuccess: "user-a-postgrest-non-success",
        rejected: "user-a-postgrest-request-rejected",
      });

      const privateUrls = [htmlResponse.url(), rscUrl, AUTH_USER_URL, USER_PREFERENCES_URL];
      await assertNoPrivateCacheKeys(page, privateUrls);

      await page.waitForURL(new RegExp(`${APP_PRIVATE_RSC_PATH}(?:[?#]|$)`));
      await page.getByRole("button", { name: SIGN_OUT_NAME }).click();
      await page.waitForURL(/\/auth\/login(?:[?#]|$)/u, { timeout: 15_000 });

      await page.getByLabel(EMAIL_NAME).fill(TEST_EMAIL);
      await page.getByLabel(PASSWORD_NAME).fill(TEST_PASSWORD);
      const userBTokenResponsePromise = page.waitForResponse(
        (response) => {
          const request = response.request();
          const target = new URL(response.url());
          return (
            request.method() === "POST" &&
            target.origin === new URL(AUTH_USER_URL).origin &&
            target.pathname === "/auth/v1/token"
          );
        },
        { timeout: 15_000 },
      );
      await page.getByRole("button", { name: SIGN_IN_NAME }).click();
      const userBTokenResponse = await userBTokenResponsePromise.catch(() => null);
      if (!userBTokenResponse) fail("user-b-login-token-missing");
      if (!userBTokenResponse.ok()) fail("user-b-login-token-non-success");
      const userBLoginCompleted = await page
        .waitForURL(/\/app\/search(?:[?#]|$)/u, { timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      if (!userBLoginCompleted) fail("user-b-login-redirect-invalid");

      const userBPage = page;
      await userBPage.goto("/offline", { waitUntil: "domcontentloaded" });
      const workerSurvivedAccountSwitch = await userBPage
        .waitForFunction(
          () =>
            navigator.serviceWorker.controller?.state === "activated" &&
            navigator.serviceWorker.controller.scriptURL === new URL("/sw.js", location.href).href,
          undefined,
          { timeout: WORKER_CONTROL_TIMEOUT_MS },
        )
        .then(() => true)
        .catch(() => false);
      if (!workerSurvivedAccountSwitch) fail("account-switch-worker-control-invalid");
      if (context.serviceWorkers().length !== 1) {
        fail("account-switch-worker-cardinality-invalid");
      }

      await context.setOffline(true);
      offline = true;

      const offlineRsc = await runBrowserProbe(userBPage, {
        headers: replayRscHeaders,
        identityKind: "none",
        url: rscUrl,
      });
      if (offlineRsc.kind !== "rejected") fail("user-a-rsc-replayed");

      const offlineAuth = await runBrowserProbe(userBPage, {
        expectedUserId: userB.userId,
        headers: sessionHeaders(userB),
        identityKind: "auth-user",
        url: AUTH_USER_URL,
      });
      if (offlineAuth.kind !== "rejected") fail("user-a-auth-replayed");

      const offlinePreferences = await runBrowserProbe(userBPage, {
        expectedUserId: userB.userId,
        headers: sessionHeaders(userB),
        identityKind: "preferences",
        url: USER_PREFERENCES_URL,
      });
      if (offlinePreferences.kind !== "rejected") {
        fail("user-a-postgrest-replayed");
      }

      const protectedNavigation = await context.newPage();
      const offlineHtmlResponse = await protectedNavigation
        .goto(APP_PRIVATE_HTML_PATH, {
          timeout: 15_000,
          waitUntil: "domcontentloaded",
        })
        .catch(() => null);
      if (!offlineHtmlResponse?.fromServiceWorker()) {
        fail("offline-protected-fallback-missing");
      }
      const offlineHtmlDigest = responseDigest(await offlineHtmlResponse.body());
      if (offlineHtmlDigest === userAHtmlDigest) fail("user-a-html-replayed");
      const offlineHeadingVisible = await protectedNavigation
        .getByRole("heading", { name: "You're offline" })
        .waitFor({ state: "visible", timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      if (!offlineHeadingVisible) fail("offline-protected-fallback-not-neutral");

      await protectedNavigation.close();
      const onlineReloadPromise = userBPage
        .waitForEvent("domcontentloaded", { timeout: WORKER_CONTROL_TIMEOUT_MS })
        .then(() => true)
        .catch(() => false);
      await context.setOffline(false);
      offline = false;
      const onlineReloadCompleted = await onlineReloadPromise;
      if (!onlineReloadCompleted) fail("online-reload-timeout");
      if (new URL(userBPage.url()).pathname !== "/offline") {
        fail("online-reload-url-invalid");
      }

      // Serwist reloads the current document on the online event. Wait for that
      // expected lifecycle before evaluating the recovered page.
      const recoveryWorkerControlsPage = await userBPage
        .waitForFunction(
          () =>
            navigator.serviceWorker.controller?.state === "activated" &&
            navigator.serviceWorker.controller.scriptURL === new URL("/sw.js", location.href).href,
          undefined,
          { timeout: WORKER_CONTROL_TIMEOUT_MS },
        )
        .then(() => true)
        .catch(() => false);
      if (!recoveryWorkerControlsPage) fail("online-recovery-worker-control-invalid");

      const userBAuth = await runObservedOnlineProbe(userBPage, {
        expectedUserId: userB.userId,
        headers: sessionHeaders(userB),
        identityKind: "auth-user",
        url: AUTH_USER_URL,
      });
      assertSuccessfulIdentityProbe(userBAuth, {
        identityMismatch: "user-b-auth-identity-mismatch",
        nonSuccess: "user-b-auth-non-success",
        rejected: "user-b-auth-request-rejected",
      });

      const userBPreferences = await runObservedOnlineProbe(userBPage, {
        expectedUserId: userB.userId,
        headers: sessionHeaders(userB),
        identityKind: "preferences",
        url: USER_PREFERENCES_URL,
      });
      assertSuccessfulIdentityProbe(userBPreferences, {
        identityMismatch: "user-b-postgrest-identity-mismatch",
        nonSuccess: "user-b-postgrest-non-success",
        rejected: "user-b-postgrest-request-rejected",
      });

      await userBPage.goto(APP_PRIVATE_RSC_PATH, {
        waitUntil: "domcontentloaded",
      });
      const authenticatedIdentityVisible = await userBPage
        .waitForFunction(
          (email) => document.body.textContent?.includes(email) === true,
          TEST_EMAIL,
          { timeout: 10_000 },
        )
        .then(() => true)
        .catch(() => false);
      expect(
        authenticatedIdentityVisible,
        "[PWA_CACHE_ISOLATION] browser-session-switch-invalid",
      ).toBe(true);

      await assertNoPrivateCacheKeys(userBPage, privateUrls);
    } finally {
      if (offline) {
        // Cleanup performs the same operation again and treats failure as
        // blocking; this early restore keeps page evaluation available.
        await context.setOffline(false).catch(() => undefined);
      }
    }
  });
});
