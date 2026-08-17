import { createHash, timingSafeEqual } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import {
  canonicalizeLoopbackOrigin,
  loadSafetyContractFromEnvironment,
  validateInvocationProof,
} from "./e2e/helpers/visual-safety";

const safetyContract = loadSafetyContractFromEnvironment(process.env);
const LOCAL_AUTHENTICATED = safetyContract.mode === "local-authenticated";
const frontendRoot = realpathSync.native(process.cwd());
const repositoryRoot = realpathSync.native(path.resolve(frontendRoot, ".."));

function pathIsWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function readStableRegularFile(filename: string, failureMessage: string): string {
  let descriptor: number | undefined;
  try {
    const noFollow = process.platform === "win32" ? 0 : fsConstants.O_NOFOLLOW;
    descriptor = openSync(filename, fsConstants.O_RDONLY | noFollow);
    const opened = fstatSync(descriptor, { bigint: true });
    const afterOpen = lstatSync(filename, { bigint: true });
    if (
      !opened.isFile() ||
      !afterOpen.isFile() ||
      afterOpen.isSymbolicLink() ||
      afterOpen.dev !== opened.dev ||
      afterOpen.ino !== opened.ino
    ) {
      throw new Error(failureMessage);
    }
    return readFileSync(descriptor, "utf8");
  } catch {
    throw new Error(failureMessage);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function enabled(name: string): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return false;
  if (value === "true") return true;
  throw new Error(`[VS_ENV_INVALID] boolean-toggle:${name}`);
}

const HAS_VISUAL = enabled("VISUAL_REGRESSION");
const HAS_SCREENSHOTS = enabled("CAPTURE_SCREENSHOTS");
const HAS_PR_SCREENSHOTS = enabled("PR_SCREENSHOTS");
const HAS_QUALITY = Boolean(process.env.QA_MODE_LEVEL);
const HAS_SAFETY_BROWSER_TESTS = enabled("VISUAL_SAFETY_BROWSER_TESTS");
const HAS_SAFETY_NEGATIVE_TESTS = enabled("VISUAL_SAFETY_NEGATIVE_TESTS");
const HAS_OWNED_SERVER = enabled("VISUAL_SAFETY_OWNED_SERVER");
const HAS_PHASE5_ROUTE_JS = enabled("PHASE5_ROUTE_JS_CAPTURE");
const HAS_PHASE5A1_CATALOG = process.env.PHASE5A1_CATALOG === "1";
const HAS_PHASE5A2_CROSS_BROWSER = enabled("PHASE5A2_CROSS_BROWSER");
const HAS_PHASE5A2_DIRECTION_REVIEW = enabled("PHASE5A2_DIRECTION_REVIEW");
const HAS_PHASE5A2_DIRECTION_BEHAVIOR = enabled("PHASE5A2_DIRECTION_BEHAVIOR");

const proxyServer = process.env.VISUAL_SAFETY_PROXY
  ? canonicalizeLoopbackOrigin(process.env.VISUAL_SAFETY_PROXY).origin
  : undefined;

if (!proxyServer) {
  throw new Error("[VS_PROXY_REQUIRED] owned-browser-egress-proxy");
}

const invocationFile = process.env.VISUAL_SAFETY_INVOCATION_FILE;
const invocationToken = process.env.VISUAL_SAFETY_INVOCATION_TOKEN;
if (!invocationFile || !path.isAbsolute(invocationFile) || !invocationToken) {
  throw new Error("[VS_INVOCATION_PROOF] launcher-proof-required");
}
const invocationTemporaryRoot = realpathSync.native(tmpdir());
if (pathIsWithin(repositoryRoot, invocationTemporaryRoot)) {
  throw new Error("[VS_INVOCATION_PROOF] temporary-root-inside-workspace");
}
const invocationLexical = path.resolve(invocationFile);
const invocationDirectory = path.dirname(invocationLexical);
const invocationDirectoryMetadata = lstatSync(invocationDirectory);
if (
  path.dirname(invocationDirectory) !== invocationTemporaryRoot ||
  !path.basename(invocationDirectory).startsWith("tryvit-visual-invocation-") ||
  !invocationDirectoryMetadata.isDirectory() ||
  invocationDirectoryMetadata.isSymbolicLink() ||
  path.basename(invocationLexical) !== "proof.json"
) {
  throw new Error("[VS_INVOCATION_PROOF] launcher-proof-invalid");
}
let invocationProof: unknown;
try {
  invocationProof = JSON.parse(
    readStableRegularFile(invocationLexical, "[VS_INVOCATION_PROOF] launcher-proof-invalid"),
  );
} catch {
  throw new Error("[VS_INVOCATION_PROOF] launcher-proof-invalid");
}
const proofRecord = invocationProof as Record<string, unknown>;
const inheritedRunnerPid = process.env.VISUAL_SAFETY_CONFIG_RUNNER_PID;
const inheritedSeal = process.env.VISUAL_SAFETY_CONFIG_SEAL;
const sealFor = (runnerPid: number, serverPid: number): string =>
  createHash("sha256")
    .update(`${invocationToken}:${runnerPid}:${serverPid}:${invocationLexical}`, "utf8")
    .digest("hex");
if (inheritedRunnerPid || inheritedSeal) {
  const runnerPid = Number(inheritedRunnerPid);
  const serverPid = Number(proofRecord.serverPid);
  const expectedSeal = sealFor(runnerPid, serverPid);
  const actualSeal = Buffer.from(inheritedSeal ?? "", "utf8");
  const expectedSealBytes = Buffer.from(expectedSeal, "utf8");
  if (
    !Number.isSafeInteger(runnerPid) ||
    runnerPid <= 0 ||
    (process.pid !== runnerPid && process.ppid !== runnerPid) ||
    actualSeal.length !== expectedSealBytes.length ||
    !timingSafeEqual(actualSeal, expectedSealBytes)
  ) {
    throw new Error("[VS_INVOCATION_PROOF] worker-seal-invalid");
  }
  validateInvocationProof(invocationProof, {
    ownerToken: invocationToken,
    launcherPid: Number(proofRecord.launcherPid),
    contract: safetyContract,
    proxyOrigin: proxyServer,
  });
} else {
  const validated = validateInvocationProof(invocationProof, {
    ownerToken: invocationToken,
    launcherPid: process.ppid,
    contract: safetyContract,
    proxyOrigin: proxyServer,
  });
  process.env.VISUAL_SAFETY_CONFIG_RUNNER_PID = String(process.pid);
  process.env.VISUAL_SAFETY_CONFIG_SEAL = sealFor(process.pid, validated.serverPid);
}

const authStateDirectory = process.env.VISUAL_SAFETY_AUTH_STATE_DIR;
const authStateOwner = process.env.VISUAL_SAFETY_AUTH_STATE_OWNER;
let verifiedAuthStateDirectory: string | undefined;
if (LOCAL_AUTHENTICATED) {
  if (
    !authStateDirectory ||
    !path.isAbsolute(authStateDirectory) ||
    !authStateOwner ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(authStateOwner)
  ) {
    throw new Error("[VS_AUTH_STATE_DIR] owned-temporary-directory-required");
  }
  const temporaryRoot = realpathSync.native(tmpdir());
  if (pathIsWithin(repositoryRoot, temporaryRoot)) {
    throw new Error("[VS_AUTH_STATE_DIR] temporary-root-inside-workspace");
  }
  const lexical = path.resolve(authStateDirectory);
  const metadata = lstatSync(lexical);
  if (
    path.dirname(lexical) !== temporaryRoot ||
    !path.basename(lexical).startsWith("tryvit-visual-auth-") ||
    !metadata.isDirectory() ||
    metadata.isSymbolicLink()
  ) {
    throw new Error("[VS_AUTH_STATE_DIR] owned-temporary-directory-invalid");
  }
  const resolved = realpathSync.native(lexical);
  if (resolved !== lexical) {
    throw new Error("[VS_AUTH_STATE_DIR] owned-temporary-directory-invalid");
  }
  const ownerMarker = path.join(resolved, ".tryvit-visual-safety-owner");
  if (
    readStableRegularFile(
      ownerMarker,
      "[VS_AUTH_STATE_DIR] owned-temporary-directory-invalid",
    ).trim() !== authStateOwner
  ) {
    throw new Error("[VS_AUTH_STATE_DIR] owned-temporary-directory-invalid");
  }
  verifiedAuthStateDirectory = resolved;
}
const authStatePath = (filename: string): string | undefined =>
  verifiedAuthStateDirectory ? path.join(verifiedAuthStateDirectory, filename) : undefined;

/* ── Project definitions ─────────────────────────────────────────────────── */

const smokeProject = {
  name: "smoke",
  testMatch: /(?:smoke(?!.*visual).*|image-policy)\.spec\.ts/,
  use: { ...devices["Desktop Chrome"] },
};

const authSetupProject = {
  name: "auth-setup",
  testMatch: /(?:^|[\\/])auth\.setup\.ts$/,
  use: { ...devices["Desktop Chrome"] },
};

const functionalAuthSetupProject = {
  name: "functional-auth-setup",
  testMatch: /(?:^|[\\/])functional\.auth\.setup\.ts$/,
  use: { ...devices["Desktop Chrome"] },
};

const authenticatedProject = {
  name: "authenticated",
  testMatch: /authenticated(?!.*visual).*\.spec\.ts/,
  dependencies: ["auth-setup"],
  use: {
    ...devices["Desktop Chrome"],
    storageState: authStatePath("user.json"),
  },
};

const functionalProject = {
  name: "functional",
  testMatch: /(?:functional.*|product-detail-tabs)\.spec\.ts/,
  dependencies: ["functional-auth-setup"],
  use: {
    ...devices["Desktop Chrome"],
    storageState: authStatePath("functional-user.json"),
  },
};

const visualSmokeProject = {
  name: "visual-smoke",
  testMatch: /smoke-visual\.spec\.ts/,
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    contextOptions: { reducedMotion: "reduce" as const },
  },
};

const visualAuthenticatedProject = {
  name: "visual-authenticated",
  testMatch: /authenticated-visual\.spec\.ts/,
  dependencies: ["auth-setup"],
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    contextOptions: { reducedMotion: "reduce" as const },
    storageState: authStatePath("user.json"),
  },
};

const screenshotsProject = {
  name: "screenshots",
  testMatch: LOCAL_AUTHENTICATED
    ? /screenshot-capture\.spec\.ts|visual-audit\.spec\.ts/
    : /visual-audit\.spec\.ts/,
  dependencies: [] as string[],
  use: {
    ...devices["Desktop Chrome"],
    bypassCSP: LOCAL_AUTHENTICATED,
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
};

const prScreenshotsProject = {
  name: "pr-screenshots",
  testMatch: /pr-screenshots\.spec\.ts/,
  dependencies: [] as string[],
  use: {
    ...devices["Desktop Chrome"],
    bypassCSP: LOCAL_AUTHENTICATED,
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
};

const qualityMobileProject = {
  name: "quality-mobile",
  testDir: "./tests/quality",
  testMatch: /mobile\.audit\.spec\.ts/,
  dependencies: LOCAL_AUTHENTICATED ? ["auth-setup"] : [],
  use: {
    ...devices["iPhone 14"],
    browserName: "chromium" as const,
    storageState: LOCAL_AUTHENTICATED ? authStatePath("user.json") : undefined,
  },
};

const qualityDesktopProject = {
  name: "quality-desktop",
  testDir: "./tests/quality",
  testMatch: /desktop\.audit\.spec\.ts/,
  dependencies: LOCAL_AUTHENTICATED ? ["auth-setup"] : [],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
    storageState: LOCAL_AUTHENTICATED ? authStatePath("user.json") : undefined,
  },
};

const safetyBrowserProject = {
  name: "visual-safety-browser",
  testMatch: /visual-safety-browser\.spec\.ts/,
  use: { ...devices["Desktop Chrome"] },
};

const safetyNegativeProject = {
  name: "visual-safety-negative",
  testMatch: /visual-safety-auto-fixture-negative\.spec\.ts/,
  use: { ...devices["Desktop Chrome"] },
};

const phase5RouteJsPublicProject = {
  name: "phase5-route-js-public",
  testMatch: /phase5a0d-route-js\.spec\.ts/,
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light" as const,
    contextOptions: { reducedMotion: "reduce" as const },
  },
};

const phase5RouteJsAuthenticatedProject = {
  name: "phase5-route-js-authenticated",
  testMatch: /phase5a0d-route-js\.spec\.ts/,
  dependencies: ["auth-setup"],
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light" as const,
    contextOptions: { reducedMotion: "reduce" as const },
    storageState: authStatePath("user.json"),
  },
};

const phase5a1CatalogProject = {
  name: "phase5a1-catalog",
  testMatch: /phase5a1-catalog\.spec\.ts/,
  dependencies: ["auth-setup"],
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    storageState: authStatePath("user.json"),
    serviceWorkers: "block" as const,
    trace: "off" as const,
    screenshot: "off" as const,
    video: "off" as const,
  },
};

const phase5a2PrimitivesFirefoxProject = {
  name: "phase5a2-primitives-firefox",
  testMatch: /phase5a2-cross-browser-primitives\.spec\.ts/,
  dependencies: ["auth-setup"],
  retries: 0,
  use: {
    ...devices["Desktop Firefox"],
    browserName: "firefox" as const,
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light" as const,
    contextOptions: { reducedMotion: "reduce" as const },
    storageState: authStatePath("user.json"),
    serviceWorkers: "block" as const,
    trace: "off" as const,
    screenshot: "off" as const,
    video: "off" as const,
  },
};

const phase5a2PrimitivesWebkitProject = {
  name: "phase5a2-primitives-webkit",
  testMatch: /phase5a2-cross-browser-primitives\.spec\.ts/,
  dependencies: ["auth-setup"],
  retries: 0,
  use: {
    ...devices["Desktop Safari"],
    browserName: "webkit" as const,
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light" as const,
    contextOptions: { reducedMotion: "reduce" as const },
    storageState: authStatePath("user.json"),
    serviceWorkers: "block" as const,
    trace: "off" as const,
    screenshot: "off" as const,
    video: "off" as const,
  },
};

const privatePwaCacheProject = {
  name: "private-pwa-cache",
  testMatch: /private-pwa-cache-isolation\.spec\.ts/,
  dependencies: ["auth-setup", "functional-auth-setup"],
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    // This project performs a real global sign-out. Start from the isolated
    // functional identity so companion authenticated audits remain valid.
    storageState: authStatePath("functional-user.json"),
    // Every other project inherits the fail-closed global/fixture default.
    // This one Chromium security regression must exercise the real worker.
    serviceWorkers: "allow" as const,
    trace: "off" as const,
    screenshot: "off" as const,
    video: "off" as const,
  },
};

const phase5a2DirectionStillsProject = {
  name: "phase5a2-direction-stills",
  testMatch: /phase5a2-direction-selection-stills\.spec\.ts/,
  dependencies: ["auth-setup"],
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light" as const,
    contextOptions: { reducedMotion: "reduce" as const },
    storageState: authStatePath("user.json"),
    serviceWorkers: "block" as const,
    trace: "off" as const,
    screenshot: "off" as const,
    video: "off" as const,
  },
};

const phase5a2DirectionMotionProject = {
  name: "phase5a2-direction-motion",
  testMatch: /phase5a2-direction-selection-motion\.spec\.ts/,
  dependencies: ["auth-setup"],
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light" as const,
    contextOptions: { reducedMotion: "no-preference" as const },
    storageState: authStatePath("user.json"),
    serviceWorkers: "block" as const,
    trace: "off" as const,
    screenshot: "off" as const,
    video: { mode: "on" as const, size: { width: 1440, height: 900 } },
  },
};

const phase5a2DirectionScannerProject = {
  name: "phase5a2-direction-scanner",
  testMatch: /phase5a2-direction-selection-scanner\.spec\.ts/,
  dependencies: ["auth-setup"],
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "dark" as const,
    contextOptions: { reducedMotion: "no-preference" as const },
    storageState: authStatePath("user.json"),
    serviceWorkers: "block" as const,
    trace: "off" as const,
    screenshot: "off" as const,
    video: { mode: "on" as const, size: { width: 390, height: 844 } },
  },
};

const phase5a2DirectionBehaviorProject = {
  name: "phase5a2-direction-behavior",
  testMatch: /phase5a2-direction-behavior\.spec\.ts/,
  dependencies: ["auth-setup"],
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    browserName: "chromium" as const,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light" as const,
    contextOptions: { reducedMotion: "no-preference" as const },
    storageState: authStatePath("user.json"),
    serviceWorkers: "block" as const,
    trace: "off" as const,
    screenshot: "off" as const,
    video: "off" as const,
  },
};

const projects = [
  ...(LOCAL_AUTHENTICATED ? [authSetupProject, functionalAuthSetupProject] : []),
  smokeProject,
  ...(LOCAL_AUTHENTICATED ? [authenticatedProject, functionalProject] : []),
  ...(LOCAL_AUTHENTICATED ? [privatePwaCacheProject] : []),
  ...(HAS_VISUAL ? [visualSmokeProject] : []),
  ...(HAS_VISUAL && LOCAL_AUTHENTICATED ? [visualAuthenticatedProject] : []),
  ...(HAS_QUALITY ? [qualityMobileProject, qualityDesktopProject] : []),
  ...(HAS_SAFETY_BROWSER_TESTS ? [safetyBrowserProject] : []),
  ...(HAS_SAFETY_NEGATIVE_TESTS ? [safetyNegativeProject] : []),
  ...(HAS_PHASE5_ROUTE_JS && !LOCAL_AUTHENTICATED ? [phase5RouteJsPublicProject] : []),
  ...(HAS_PHASE5_ROUTE_JS && LOCAL_AUTHENTICATED ? [phase5RouteJsAuthenticatedProject] : []),
  ...(HAS_PHASE5A1_CATALOG && LOCAL_AUTHENTICATED ? [phase5a1CatalogProject] : []),
  ...(HAS_PHASE5A2_CROSS_BROWSER && LOCAL_AUTHENTICATED
    ? [phase5a2PrimitivesFirefoxProject, phase5a2PrimitivesWebkitProject]
    : []),
  ...(HAS_PHASE5A2_DIRECTION_BEHAVIOR && LOCAL_AUTHENTICATED
    ? [phase5a2DirectionBehaviorProject]
    : []),
  ...(HAS_PHASE5A2_DIRECTION_REVIEW && LOCAL_AUTHENTICATED
    ? [
        phase5a2DirectionStillsProject,
        phase5a2DirectionMotionProject,
        phase5a2DirectionScannerProject,
      ]
    : []),
  ...(HAS_SCREENSHOTS ? [screenshotsProject] : []),
  ...(HAS_PR_SCREENSHOTS ? [prScreenshotsProject] : []),
];

/* ── Configuration ───────────────────────────────────────────────────────── */

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never" }],
        ["json", { outputFile: "test-results/a11y-results.json" }],
      ]
    : "html",
  globalTimeout: 600_000,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      threshold: 0.2,
    },
  },
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  ...(LOCAL_AUTHENTICATED && { globalTeardown: "./e2e/global-teardown" }),
  use: {
    baseURL: safetyContract.appOrigin,
    serviceWorkers: "block",
    ...(proxyServer ? { proxy: { server: proxyServer } } : {}),
    // Traces can contain headers, cookies, and URLs. Safety infrastructure uses
    // redacted count-only markers instead of credential-bearing traces.
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects,
  ...(HAS_OWNED_SERVER
    ? {}
    : {
        webServer: {
          command:
            "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types e2e/scripts/visual-safety-cli.mts serve",
          // The CLI serve command performs its own complete preflight. The
          // main wrappers normally own the server before Playwright starts.
          port: 3000,
          reuseExistingServer: false,
          timeout: 60_000,
          env: {
            VISUAL_SAFETY_MODE: safetyContract.mode,
            VISUAL_SAFETY_APP_ORIGIN: safetyContract.appOrigin,
            BASE_URL: safetyContract.appOrigin,
            VISUAL_SAFETY_SUPABASE_ORIGIN: safetyContract.supabaseOrigin ?? "",
            NEXT_PUBLIC_SUPABASE_URL: safetyContract.supabaseOrigin ?? "",
            NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
            SUPABASE_SERVICE_ROLE_KEY: "",
          },
        },
      }),
});
