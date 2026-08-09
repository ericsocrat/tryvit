import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const frontendRoot = path.resolve(__dirname, "..");
const e2eRoot = path.join(frontendRoot, "e2e");

function filesBelow(root: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...filesBelow(candidate));
    else if (entry.isFile()) output.push(candidate);
  }
  return output;
}

function source(filename: string): string {
  return readFileSync(filename, "utf8");
}

describe("Playwright fixture safety contract", () => {
  it("routes every e2e test/setup file through the safe fixture", () => {
    const runnable = filesBelow(e2eRoot).filter((filename) =>
      /(?:\.spec\.ts|(?:^|[\\/])(?:auth|functional\.auth)\.setup\.ts)$/u.test(filename),
    );
    expect(runnable.length).toBeGreaterThan(30);
    for (const filename of runnable) {
      const contents = source(filename);
      expect(contents, path.relative(frontendRoot, filename)).toMatch(
        /from "\.\/fixtures\/safe-test"/u,
      );
      expect(contents, path.relative(frontendRoot, filename)).not.toMatch(
        /(?:test|setup).*from "@playwright\/test"/u,
      );
    }
  });

  it("installs HTTP/WebSocket guards and blocks service workers", () => {
    const fixture = source(path.join(e2eRoot, "fixtures", "safe-test.ts"));
    expect(fixture).toContain("installBrowserEgressGuards");
    expect(fixture).toContain('serviceWorkers: "block"');
    expect(fixture).toContain("assertNoEgressViolations");
    expect(fixture).toContain("{ auto: true }");
  });

  it("has no raw fixture fetch outside the reusable guarded transport", () => {
    const candidates = filesBelow(e2eRoot).filter(
      (filename) =>
        filename.endsWith(".ts") &&
        !filename.endsWith("visual-safety.ts") &&
        !filename.endsWith("visual-safety-cli.mts") &&
        !filename.endsWith("visual-safety-browser.spec.ts") &&
        // This one Chromium-only regression must make real browser fetches so
        // the service worker can prove it never replays private responses.
        !filename.endsWith("private-pwa-cache-isolation.spec.ts") &&
        !filename.endsWith("visual-safety-auto-fixture-negative.spec.ts"),
    );
    for (const filename of candidates) {
      expect(source(filename), path.relative(frontendRoot, filename)).not.toMatch(/\bfetch\s*\(/u);
    }
  });

  it("constructs Supabase clients only through guarded fetch and WebSocket", () => {
    const clientFiles = filesBelow(e2eRoot).filter((filename) =>
      source(filename).includes("createClient("),
    );
    expect(clientFiles.map((value) => path.basename(value))).toEqual(["test-user.ts"]);
    const helper = source(clientFiles[0]);
    expect(helper).toContain("global: { fetch: runtime.fetch }");
    expect(helper).toContain("createGuardedWebSocketConstructor");
    expect(helper.indexOf("loadSafetyContractFromEnvironment")).toBeLessThan(
      helper.indexOf("process.env.SUPABASE_SERVICE_ROLE_KEY"),
    );
  });

  it.each(["pr-screenshots.spec.ts", "screenshot-capture.spec.ts", "visual-audit.spec.ts"])(
    "makes %s cleanup blocking and teardown-owned",
    (filename) => {
      const contents = source(path.join(e2eRoot, filename));
      expect(contents).toContain("test.afterAll");
      expect(contents).toContain("if (!listRes.ok)");
      expect(contents).toContain("if (!deleteRes.ok)");
      expect(contents).not.toMatch(/Best-effort cleanup|best effort/u);
    },
  );

  it("does not mask local SDK cleanup failures", () => {
    const onboarding = source(path.join(e2eRoot, "functional-onboarding.spec.ts"));
    expect(onboarding).toContain("onboarding-user-cleanup-list");
    expect(onboarding).toContain("onboarding-user-cleanup-delete");
    expect(onboarding).toContain("test.afterAll");

    const globalTeardown = source(path.join(e2eRoot, "global-teardown.ts"));
    expect(globalTeardown).not.toContain("try {");
    expect(globalTeardown).not.toContain("non-fatal");
  });

  it("does not infer auth mode from a service-role variable", () => {
    const config = source(path.join(frontendRoot, "playwright.config.ts"));
    expect(config).not.toMatch(/HAS_AUTH/u);
    expect(config).not.toMatch(/!!process\.env\.SUPABASE_SERVICE_ROLE_KEY/u);
    expect(config).toContain('safetyContract.mode === "local-authenticated"');
    expect(config).toContain('serviceWorkers: "block"');
    expect(config).toContain("port: 3000");
    expect(config).not.toContain("webServer: {\n    url:");
    expect(config).not.toContain("e2e/.auth/");
    expect(config).not.toContain("test-results/visual-safety-auth/");
    expect(config).toContain("VISUAL_SAFETY_AUTH_STATE_DIR");
    expect(config).toContain("VISUAL_SAFETY_AUTH_STATE_OWNER");
    expect(config).toContain(".tryvit-visual-safety-owner");
    expect(config).toContain("VISUAL_SAFETY_INVOCATION_FILE");
    expect(config).toContain("VISUAL_SAFETY_INVOCATION_TOKEN");
    expect(config).toContain("validateInvocationProof");
    expect(config).toContain("readStableRegularFile");
    expect(config).toContain("fstatSync(descriptor, { bigint: true })");
    expect(config).toContain("lstatSync(filename, { bigint: true })");
    expect(config).toContain('readFileSync(descriptor, "utf8")');
    expect(config).not.toContain("beforeOpen");
    expect(config).not.toContain("realpathSync.native(invocationLexical)");
    expect(config).not.toContain('readFileSync(invocationLexical, "utf8")');
    expect(config).not.toContain('readFileSync(ownerMarker, "utf8")');
    expect(config.indexOf("lstatSync(lexical)")).toBeLessThan(
      config.indexOf("realpathSync.native(lexical)"),
    );
  });

  it("allows service workers only in the dedicated private-cache regression", () => {
    const config = source(path.join(frontendRoot, "playwright.config.ts"));
    const regression = source(path.join(e2eRoot, "private-pwa-cache-isolation.spec.ts"));
    const allowOccurrences = config.match(/serviceWorkers: "allow"/gu) ?? [];

    expect(allowOccurrences).toHaveLength(1);
    expect(config).toMatch(
      /name: "private-pwa-cache"[\s\S]*dependencies: \["auth-setup", "functional-auth-setup"\][\s\S]*retries: 0[\s\S]*storageState: authStatePath\("functional-user\.json"\)[\s\S]*serviceWorkers: "allow"/u,
    );
    expect(config).toMatch(
      /name: "private-pwa-cache"[\s\S]*trace: "off"[\s\S]*screenshot: "off"[\s\S]*video: "off"/u,
    );
    expect(config).toContain('serviceWorkers: "block"');
    expect(regression).toContain('from "./fixtures/safe-test"');
    expect(regression).toContain("loadSafetyContractFromEnvironment");
    expect(regression).toContain('safetyContract.mode !== "local-authenticated"');
    expect(regression).toContain('test.use({ serviceWorkers: "allow" })');
    expect(regression).toContain('credentials: "same-origin"');
    expect(regression).not.toContain('credentials: "include"');
    expect(regression).toContain("finally {");
    expect(regression).toContain("test.afterEach");
    expect(regression).toContain("testInfo.setTimeout(CLEANUP_TIMEOUT_MS)");
    expect(regression).toContain("cleanupBrowserPrivateState");
    expect(regression).toContain("worker-activation-timeout");
    expect(regression).toContain("account-switch-worker-control-invalid");
    expect(regression).toContain("account-switch-worker-cardinality-invalid");
    expect(regression).toContain('controller?.state === "activated"');
    expect(regression).not.toContain("navigator.serviceWorker.ready");
    expect(regression).toContain("LEGACY_PRIVATE_CACHE_NAMES");
    expect(regression).toContain("synthetic-private-cache-sentinel");
    expect(regression).toContain("synthetic-unrelated-cache-sentinel");
    expect(regression).toContain('getByRole("button", { name: "Sign Out" })');
    expect(regression).toContain('getScopedTestSession("functional")');
    expect(regression).toContain('getScopedTestSession("authenticated")');
    expect(regression).toContain('getByLabel("Email").fill(TEST_EMAIL)');
    expect(regression).toContain('getByLabel("Password", { exact: true }).fill(TEST_PASSWORD)');
    expect(regression.indexOf('getByRole("button", { name: "Sign Out" })')).toBeLessThan(
      regression.indexOf('getByLabel("Email").fill(TEST_EMAIL)'),
    );
    expect(regression.match(/context\.setStorageState\(/gu)).toHaveLength(1);
    expect(regression).toContain(
      "await context.setStorageState({ cookies: [], origins: [] })",
    );
    expect(regression).not.toContain("await page.close()");
    expect(regression).not.toMatch(/console\.(?:log|info|warn|error)/u);
    expect(regression).not.toMatch(/storageState\(\{\s*path:/u);
  });

  it("routes quality audits through the guard and selects auth explicitly", () => {
    for (const filename of ["mobile.audit.spec.ts", "desktop.audit.spec.ts"]) {
      const contents = source(path.join(frontendRoot, "tests", "quality", filename));
      expect(contents).toContain('from "../../e2e/fixtures/safe-test"');
      expect(contents).toContain('process.env.VISUAL_SAFETY_MODE === "local-authenticated"');
      expect(contents).not.toMatch(
        /!!process\.env\.(?:NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)/u,
      );
    }
  });
});
