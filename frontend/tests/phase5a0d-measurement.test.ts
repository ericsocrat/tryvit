import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  MEASUREMENT_ROUTES,
  PHASE5A0D_FIXED_TIME,
  VISUAL_BASELINE_CASES,
  VISUAL_FIXTURE_CONTRACT,
  VISUAL_MAX_DIFF_PIXEL_RATIO,
  assertRepresentativeRouteContract,
  assertVisualBaselineContract,
  calculateRegression,
  median,
  resolveFixturePath,
  summarizeNumbers,
} from "../tooling/phase5a0d-contract";
import {
  combineModeReports,
  compareRouteJsModeReports,
  compareRouteJsReports,
  classifyRouteScriptRequest,
  compileModeReport,
  normalizeRuntimeAssetPath,
  resetRouteJsCaptureDirectory,
  routeFixtureStateForMode,
  validateContainedScriptResponse,
  validateRouteJsCapture,
  validateRouteJsReport,
  type RouteJsCapture,
  type RouteJsModeReport,
} from "../tooling/phase5a0d-route-js";
import {
  listPhase5BaselinePngs,
  prepareVisualBaselineWriteTargets,
  rendererIdentityMismatchFields,
  validateVisualBaselineManifest,
  visualArtifactRelativeFiles,
  visualFixtureContractChecksum,
  visualRelativeFile,
} from "../tooling/phase5a0d-visual-baselines";

const routeJsToolSource = readFileSync(
  path.resolve(process.cwd(), "tooling", "phase5a0d-route-js.ts"),
  "utf8",
);
const routeJsCliSource = readFileSync(
  path.resolve(process.cwd(), "tooling", "phase5a0d-route-js-cli.mts"),
  "utf8",
);

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function checksum(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function capture(
  id: string,
  mode: RouteJsCapture["mode"],
  assetSuffix = id,
  containmentMarkers: RouteJsCapture["containmentMarkers"] = [],
): RouteJsCapture {
  const route = MEASUREMENT_ROUTES.find((candidate) => candidate.id === id)!;
  const withoutChecksum = {
    schemaVersion: 1,
    kind: "phase5a0d-route-js-capture" as const,
    sourceCommit: "a".repeat(40),
    environmentClass: "ci-linux-authoritative" as const,
    platform: "linux",
    nodeVersion: "v22.21.1",
    zlibVersion: "1.3.1",
    nextVersion: "16.2.12",
    chromiumVersion: "143.0.7499.4",
    buildId: mode === "public" ? "public-build" : "auth-build",
    buildFingerprint: mode === "public" ? "2".repeat(64) : "3".repeat(64),
    mode,
    fixtureState: routeFixtureStateForMode(mode),
    browserProfile: {
      id: "playwright-desktop-chrome-1440x900-light-reduced" as const,
      userAgent: "test-chromium",
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      locale: "en-US",
      timezoneId: "UTC",
      colorScheme: "light" as const,
      reducedMotion: "reduce" as const,
    },
    route: {
      id,
      label: route.label,
      requestedPath: route.path,
      finalPath: route.path,
      boundary: route.boundary,
      requiresLocalFixture: route.requiresLocalFixture,
    },
    assets: [
      {
        path: "/_next/static/chunks/shared.js",
        rawBytes: 100,
        gzipBytes: 70,
        encodedBodyBytes: 70,
        decodedBodyBytes: 100,
        sha256: "1".repeat(64),
      },
      {
        path: `/_next/static/chunks/${assetSuffix}.js`,
        rawBytes: 80,
        gzipBytes: 50,
        encodedBodyBytes: 50,
        decodedBodyBytes: 80,
        sha256: createHash("sha256").update(assetSuffix).digest("hex"),
      },
    ],
    containmentMarkers,
  };
  return { ...withoutChecksum, captureChecksum: checksum(withoutChecksum) };
}

function modeReport(mode: RouteJsCapture["mode"]): RouteJsModeReport {
  const ids = MEASUREMENT_ROUTES.filter(
    (route) => route.requiresLocalFixture === (mode === "local-authenticated"),
  ).map((route) => route.id);
  const captures = ids.map((id) => capture(id, mode));
  const routes = captures.map((item) => ({
    id: item.route.id,
    label: item.route.label,
    path: item.route.requestedPath,
    mode,
    boundary: item.route.boundary,
    requiresLocalFixture: item.route.requiresLocalFixture,
    fixtureState: item.fixtureState,
    containmentMarkers: item.containmentMarkers,
    chunkCount: 2,
    rawBytes: 180,
    gzipBytes: 120,
    sharedGzipBytes: 70,
    routeOwnedGzipBytes: 50,
    encodedTransferBytes: 120,
    targetGzipBytes: MEASUREMENT_ROUTES.find((route) => route.id === item.route.id)!
      .initialJsTargetGzipBytes,
    targetMet:
      MEASUREMENT_ROUTES.find((route) => route.id === item.route.id)!.initialJsTargetGzipBytes ===
      null
        ? null
        : true,
    assets: item.assets.map((asset, index) => ({
      ...asset,
      classification: index === 0 ? ("shared" as const) : ("route-owned" as const),
      routeUsageCount: index === 0 ? ids.length : 1,
    })),
  }));
  const withoutChecksum = {
    schemaVersion: 1,
    kind: "phase5a0d-route-js-mode" as const,
    sourceCommit: "a".repeat(40),
    environmentClass: "ci-linux-authoritative" as const,
    platform: "linux",
    nodeVersion: "v22.21.1",
    zlibVersion: "1.3.1",
    nextVersion: "16.2.12",
    chromiumVersion: "143.0.7499.4",
    mode,
    fixtureState: captures[0].fixtureState,
    containmentMarkers: [
      ...new Set(captures.flatMap((item) => item.containmentMarkers)),
    ].sort() as RouteJsCapture["containmentMarkers"],
    buildId: mode === "public" ? "public-build" : "auth-build",
    buildFingerprint: mode === "public" ? "2".repeat(64) : "3".repeat(64),
    browserProfile: captures[0].browserProfile,
    compression: "gzip-level-9" as const,
    sourceOfTruth: "cold-browser-next-static-script-responses" as const,
    routeCount: routes.length,
    routes,
  };
  return { ...withoutChecksum, reportChecksum: checksum(withoutChecksum) };
}

describe("Phase 5A.0d measurement contract", () => {
  it("keeps exactly the representative route policy", () => {
    expect(() => assertRepresentativeRouteContract()).not.toThrow();
    expect(MEASUREMENT_ROUTES.map((route) => route.id)).toEqual([
      "landing",
      "login",
      "contact",
      "app-shell",
      "product-detail",
    ]);
  });

  it("requires a deterministic positive fixture product ID", () => {
    expect(resolveFixturePath("/app/product/:fixtureProductId", "42")).toBe("/app/product/42");
    expect(() => resolveFixturePath("/app/product/:fixtureProductId", "0")).toThrow(
      "positive-product-id-required",
    );
  });

  it("calculates medians and reports the full run range", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    const summary = summarizeNumbers([0.8, 0.9, 0.7]);
    expect(summary.values).toEqual([0.7, 0.8, 0.9]);
    expect(summary.median).toBe(0.8);
    expect(summary.range).toBeCloseTo(0.2);
    expect(summary.medianAbsoluteDeviation).toBeCloseTo(0.1);
    expect(() => median([])).toThrow("median-requires-values");
  });

  it("pins the deliberate seven-image visual baseline matrix", () => {
    expect(() => assertVisualBaselineContract()).not.toThrow();
    expect(VISUAL_BASELINE_CASES).toHaveLength(7);
    expect(
      VISUAL_BASELINE_CASES.every((item) => item.filename.endsWith("-light-reduced.png")),
    ).toBe(true);
    expect(VISUAL_BASELINE_CASES.some((item) => item.mode === "local-authenticated")).toBe(true);
  });

  it("binds baselines to a non-secret logical fixture contract", () => {
    expect(VISUAL_FIXTURE_CONTRACT.localAuthenticatedNewUser).toMatchObject({
      lifecycle: "fresh-user-deleted-after-run",
      preferences: {
        country: "PL",
        preferredLanguage: "en",
        onboardingCompleted: false,
        onboardingSkipped: true,
      },
      requiredPageMarker: "new-user-welcome",
    });
    expect(visualFixtureContractChecksum()).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.stringify(VISUAL_FIXTURE_CONTRACT)).not.toMatch(
      /(?:password|token|credential|userId|productId)/iu,
    );
  });

  it("prepares only owned visual baseline target directories", () => {
    const frontendRoot = mkdtempSync(path.join(tmpdir(), "tryvit-visual-targets-"));
    try {
      mkdirSync(path.join(frontendRoot, "e2e"));
      const root = prepareVisualBaselineWriteTargets(frontendRoot);
      expect(root).toBe(path.join(realpathSync.native(frontendRoot), "e2e", "__screenshots__"));
      expect(existsSync(path.join(root, "smoke-visual.spec.ts"))).toBe(true);
      expect(existsSync(path.join(root, "authenticated-visual.spec.ts"))).toBe(true);
    } finally {
      rmSync(frontendRoot, { recursive: true, force: false });
    }
  });

  it("fails before generation when the baseline root is not an owned directory", () => {
    const frontendRoot = mkdtempSync(path.join(tmpdir(), "tryvit-visual-reparse-"));
    try {
      mkdirSync(path.join(frontendRoot, "e2e"));
      writeFileSync(path.join(frontendRoot, "e2e", "__screenshots__"), "not-a-directory");
      expect(() => prepareVisualBaselineWriteTargets(frontendRoot)).toThrow(
        "baseline-root-reparse",
      );
    } finally {
      rmSync(frontendRoot, { recursive: true, force: false });
    }
  });

  it("rejects a baseline-root symlink before Playwright can update snapshots", () => {
    const frontendRoot = mkdtempSync(path.join(tmpdir(), "tryvit-visual-symlink-"));
    const outside = mkdtempSync(path.join(tmpdir(), "tryvit-visual-outside-"));
    const baselineRoot = path.join(frontendRoot, "e2e", "__screenshots__");
    try {
      mkdirSync(path.join(frontendRoot, "e2e"));
      symlinkSync(outside, baselineRoot, process.platform === "win32" ? "junction" : "dir");
      expect(() => prepareVisualBaselineWriteTargets(frontendRoot)).toThrow(
        "baseline-root-reparse",
      );
    } finally {
      if (existsSync(baselineRoot)) rmSync(baselineRoot, { recursive: true, force: false });
      rmSync(frontendRoot, { recursive: true, force: false });
      rmSync(outside, { recursive: true, force: false });
    }
  });

  it("finds unlisted Phase 5 PNGs at the root and at arbitrary depth", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tryvit-visual-extras-"));
    try {
      mkdirSync(path.join(root, "nested", "deeper"), { recursive: true });
      writeFileSync(path.join(root, "p5a0d-root-extra.png"), "root");
      writeFileSync(path.join(root, "nested", "deeper", "p5a0d-deep-extra.png"), "deep");
      expect(listPhase5BaselinePngs(root)).toEqual([
        "nested/deeper/p5a0d-deep-extra.png",
        "p5a0d-root-extra.png",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: false });
    }
  });

  it("fails a positive regression when either the byte or percent limit is exceeded", () => {
    expect(calculateRegression(100 * 1024, 106 * 1024)).toMatchObject({
      exceedsAbsoluteLimit: false,
      exceedsPercentLimit: true,
      failed: true,
    });
    expect(calculateRegression(400 * 1024, 411 * 1024)).toMatchObject({
      exceedsAbsoluteLimit: true,
      exceedsPercentLimit: false,
      failed: true,
    });
    expect(calculateRegression(100 * 1024, 80 * 1024).failed).toBe(false);
  });
});

describe("cold-browser route JavaScript evidence", () => {
  it("accepts only concrete Next static JavaScript paths", () => {
    expect(normalizeRuntimeAssetPath("/_next/static/chunks/app/%5Bid%5D/page.js")).toBe(
      "/_next/static/chunks/app/[id]/page.js",
    );
    expect(() => normalizeRuntimeAssetPath("/_next/static/../secret.js")).toThrow(
      "runtime-asset-path-invalid",
    );
    expect(() => normalizeRuntimeAssetPath("/api/flags")).toThrow("runtime-asset-path-invalid");
  });

  it("validates checksummed captures and rejects tampering", () => {
    const valid = capture("landing", "public");
    expect(() => validateRouteJsCapture(valid)).not.toThrow();
    const tampered = structuredClone(valid);
    tampered.assets[0].gzipBytes += 1;
    expect(() => validateRouteJsCapture(tampered)).toThrow("capture-checksum-mismatch");
  });

  it("binds captures to logical fixture state without persisting database IDs or secrets", () => {
    const valid = capture("product-detail", "local-authenticated");
    expect(valid.route.requestedPath).toBe("/app/product/:fixtureProductId");
    expect(valid.fixtureState).toEqual(routeFixtureStateForMode("local-authenticated"));
    expect(valid.fixtureState.stateChecksum).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.stringify(valid.fixtureState)).not.toMatch(
      /(?:password|token|credential|productId|userId|QA_PRODUCT_ID|\/app\/product\/[0-9]+)/iu,
    );

    const tampered = structuredClone(valid) as Record<string, unknown>;
    tampered.fixtureState = {
      logicalIdentity: "phase5a0d-local-new-user-primary-product-v1",
      stateChecksum: "f".repeat(64),
    };
    const { captureChecksum: _checksum, ...payload } = tampered;
    expect(() =>
      validateRouteJsCapture({ ...payload, captureChecksum: checksum(payload) }),
    ).toThrow("fixture-state-identity-invalid:local-authenticated");
  });

  it("recognizes only exact contained provider script requests", () => {
    const origin = "http://127.0.0.1:3000";
    expect(
      classifyRouteScriptRequest(
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit",
        origin,
      ),
    ).toBe("exact-turnstile-stub");
    expect(
      classifyRouteScriptRequest("http://127.0.0.1:3000/_vercel/speed-insights/script.js", origin),
    ).toBe("exact-local-speed-insights-stub");
    for (const nearMatch of [
      "https://challenges.cloudflare.com/turnstile/v0/api.js",
      "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=wrong&render=explicit",
      "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit&extra=1",
      "http://127.0.0.1:3000/_vercel/speed-insights/script.js?debug=1",
      "http://localhost:3000/_vercel/speed-insights/script.js",
      "https://provider.invalid/executable.js",
    ]) {
      expect(classifyRouteScriptRequest(nearMatch, origin), nearMatch).toBe("unexpected-script");
    }
  });

  it("accepts only the exact inert provider response status, content type, and body", () => {
    expect(
      validateContainedScriptResponse({
        kind: "exact-turnstile-stub",
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: "/* TryVit visual-safety: Cloudflare Turnstile intentionally contained. */",
      }),
    ).toBe("contained-cloudflare-turnstile-exact-stub");
    expect(
      validateContainedScriptResponse({
        kind: "exact-local-speed-insights-stub",
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: "/* TryVit visual-safety: local Vercel Speed Insights intentionally contained. */",
      }),
    ).toBe("contained-local-vercel-speed-insights-inert");
    for (const invalid of [
      { status: 204, body: "" },
      { status: 200, body: "console.log('unexpected executable payload')" },
      { status: 404, body: "not found" },
    ]) {
      expect(() =>
        validateContainedScriptResponse({
          kind: "exact-local-speed-insights-stub",
          status: invalid.status,
          contentType: "application/javascript; charset=utf-8",
          body: invalid.body,
        }),
      ).toThrow("contained-script-response-invalid:exact-local-speed-insights-stub");
    }
  });

  it("audits request, response, and requestfailed events and rejects error shells", () => {
    expect(routeJsToolSource).toContain('page.on("request", onRequest)');
    expect(routeJsToolSource).toContain('page.on("requestfailed", onRequestFailed)');
    expect(routeJsToolSource).toContain('page.on("response", onResponse)');
    expect(routeJsToolSource).toContain("unexpected-script-executable-response");
    expect(routeJsToolSource).toContain("script-request-terminal-event-missing");
    expect(routeJsToolSource).toContain("route-error-or-not-found-shell");
    for (const routeMarker of [
      "healthier choices, made simple",
      "Welcome back",
      "mailto:hello@example.com",
      "new-user-welcome",
      "QA Dairy Milk Gouda 45%",
      "QA Test Brand",
    ]) {
      expect(routeJsToolSource).toContain(routeMarker);
    }
  });

  it("preserves validated containment markers through mode and final reports", () => {
    const publicCaptures = [
      capture("landing", "public", "landing", ["contained-local-vercel-speed-insights-inert"]),
      capture("login", "public", "login", ["contained-cloudflare-turnstile-exact-stub"]),
      capture("contact", "public"),
    ];
    const publicReport = compileModeReport(publicCaptures, "public");
    expect(publicReport.containmentMarkers).toEqual([
      "contained-cloudflare-turnstile-exact-stub",
      "contained-local-vercel-speed-insights-inert",
    ]);
    expect(publicReport.routes.find((route) => route.id === "login")?.containmentMarkers).toEqual([
      "contained-cloudflare-turnstile-exact-stub",
    ]);
    const combined = combineModeReports([publicReport, modeReport("local-authenticated")]);
    expect(
      combined.runtimeModes.find((runtime) => runtime.mode === "public")?.containmentMarkers,
    ).toEqual(publicReport.containmentMarkers);
    expect(() => validateRouteJsReport(combined)).not.toThrow();
  });

  it("rejects capture directory symlinks before recursive reset", () => {
    const frontendRoot = mkdtempSync(path.join(tmpdir(), "tryvit-route-js-owned-"));
    const outside = mkdtempSync(path.join(tmpdir(), "tryvit-route-js-outside-"));
    try {
      const captureRoot = path.join(frontendRoot, "performance-reports", "route-js-captures");
      resetRouteJsCaptureDirectory(captureRoot, "public", frontendRoot);
      rmSync(path.join(captureRoot, "public"), { recursive: true, force: false });
      symlinkSync(
        outside,
        path.join(captureRoot, "public"),
        process.platform === "win32" ? "junction" : "dir",
      );
      expect(() => resetRouteJsCaptureDirectory(captureRoot, "public", frontendRoot)).toThrow(
        "capture-directory-reparse",
      );
    } finally {
      rmSync(frontendRoot, { recursive: true, force: false });
      rmSync(outside, { recursive: true, force: false });
    }
  });

  it("guards route report inputs and outputs against reparse points before writes", () => {
    expect(routeJsCliSource).toContain("function isExactRealPath(");
    expect(routeJsCliSource).toContain("!isExactRealPath(reportsRoot)");
    expect(routeJsCliSource).toContain("function ensureOwnedParent(");
    expect(routeJsCliSource).toContain("!isExactRealPath(resolved)");
    expect(routeJsCliSource).toContain("function readJsonFileNoFollow(");
    expect(routeJsCliSource).toContain("fstatSync(descriptor, { bigint: true })");
    expect(routeJsCliSource).toContain('readFileSync(descriptor, "utf8")');
    expect(routeJsToolSource).toContain("fstatSync(descriptor, { bigint: true })");
    expect(routeJsToolSource).toContain("ftruncateSync(descriptor, 0)");
    expect(routeJsToolSource).toContain("writeFileSync(descriptor");
    expect(routeJsToolSource).not.toContain("writeFileSync(outputFile");
    expect(routeJsCliSource).not.toContain("mkdirSync(parent, { recursive: true })");
  });

  it("combines separate public and local-authenticated runtime reports", () => {
    const combined = combineModeReports([modeReport("public"), modeReport("local-authenticated")]);
    expect(combined.routes.map((route) => route.id)).toEqual(
      MEASUREMENT_ROUTES.map((route) => route.id),
    );
    expect(combined.sourceOfTruth).toBe("cold-browser-next-static-script-responses");
    expect(() => validateRouteJsReport(combined)).not.toThrow();
    expect(compareRouteJsReports(combined, combined).failed).toBe(false);
  });

  it("derives shared accounting from measured paths and validates all totals", () => {
    const captures = [
      capture("landing", "public"),
      capture("login", "public"),
      capture("contact", "public"),
    ];
    const report = compileModeReport(captures, "public");
    expect(report.routes.map((route) => route.sharedGzipBytes)).toEqual([70, 70, 70]);
    expect(report.routes.map((route) => route.routeOwnedGzipBytes)).toEqual([50, 50, 50]);
    expect(compareRouteJsModeReports(report, report).failed).toBe(false);
  });

  it("rejects semantic tampering even when a report checksum is recomputed", () => {
    const original = modeReport("public");
    const withoutChecksum = {
      ...original,
      routes: original.routes.map((route) =>
        route.id === "login" ? { ...route, targetMet: true } : route,
      ),
    };
    const { reportChecksum: _oldChecksum, ...tamperedPayload } = withoutChecksum;
    const tampered = {
      ...tamperedPayload,
      reportChecksum: checksum(tamperedPayload),
    };
    expect(() => combineModeReports([tampered, modeReport("local-authenticated")])).toThrow(
      "measurement-route-contract-invalid:login",
    );
  });

  it("rejects environment drift instead of comparing incompatible measurements", () => {
    const baseline = modeReport("public");
    const { reportChecksum: _checksum, ...changedPayload } = {
      ...baseline,
      chromiumVersion: "152.0.0.0",
    };
    const changed = {
      ...changedPayload,
      reportChecksum: checksum(changedPayload),
    };
    expect(() => compareRouteJsModeReports(baseline, changed)).toThrow(
      "comparison-environment-mismatch:chromiumVersion",
    );
  });
});

describe("visual baseline manifest contract", () => {
  function visualManifest() {
    const withoutChecksum = {
      schemaVersion: 1,
      kind: "phase5a0d-visual-baselines" as const,
      sourceCommit: "b".repeat(40),
      rendererClass: "ci-linux-authoritative" as const,
      runner: { imageOS: "ubuntu24", imageVersion: "20260727.1", arch: "x64" },
      versions: {
        node: "v22.21.1",
        npm: "10.9.4",
        next: "16.2.12",
        playwright: "1.62.0",
        chromium: "151.0.7922.34",
      },
      settings: {
        locale: "en-US" as const,
        timezoneId: "UTC" as const,
        deviceScaleFactor: 1 as const,
        colorScheme: "light" as const,
        reducedMotion: "reduce" as const,
        fixedTime: PHASE5A0D_FIXED_TIME,
        fullPage: false as const,
        masks: [] as const,
        maxDiffPixelRatio: VISUAL_MAX_DIFF_PIXEL_RATIO,
        channelThreshold: 0.2 as const,
      },
      fixtureContractChecksum: visualFixtureContractChecksum(),
      cases: VISUAL_BASELINE_CASES.map((baseline) => ({
        id: baseline.id,
        mode: baseline.mode,
        routeId: baseline.routeId,
        path: baseline.path,
        width: baseline.width,
        height: baseline.height,
        fixtureState: baseline.fixtureState,
        relativeFile: visualRelativeFile(baseline),
        sha256: "d".repeat(64),
        bytes: 100,
      })),
    };
    return {
      ...withoutChecksum,
      manifestChecksum: checksum(withoutChecksum),
    };
  }

  it("accepts the exact checksummed seven-file manifest", () => {
    expect(() => validateVisualBaselineManifest(visualManifest())).not.toThrow();
  });

  it("reports only the non-secret renderer identity fields that drift", () => {
    const expected = visualManifest();
    const actual = structuredClone(expected);
    expect(rendererIdentityMismatchFields(expected, actual)).toEqual([]);

    actual.runner.imageVersion = "20991231.999.1";
    actual.versions.npm = "99.0.0";
    expect(rendererIdentityMismatchFields(expected, actual)).toEqual([
      "runner.imageVersion",
      "versions.npm",
    ]);
  });

  it("rejects missing cases and checksum tampering", () => {
    const missing = { ...visualManifest(), cases: visualManifest().cases.slice(0, 6) };
    expect(() => validateVisualBaselineManifest(missing)).toThrow("manifest-schema-invalid");
    const tampered = structuredClone(visualManifest());
    tampered.cases[0].bytes += 1;
    expect(() => validateVisualBaselineManifest(tampered)).toThrow("manifest-checksum-mismatch");
  });

  it("rejects a recomputed manifest with viewport or fixture-state drift", () => {
    for (const mutation of [
      (candidate: ReturnType<typeof visualManifest>) => {
        candidate.cases[0].width = 768;
      },
      (candidate: ReturnType<typeof visualManifest>) => {
        candidate.cases[5].fixtureState = "public-static";
      },
    ]) {
      const candidate = structuredClone(visualManifest());
      mutation(candidate);
      const { manifestChecksum: _checksum, ...payload } = candidate;
      const recomputed = { ...payload, manifestChecksum: checksum(payload) };
      expect(() => validateVisualBaselineManifest(recomputed)).toThrow("manifest-case-invalid");
    }
  });

  it("stages only seven PNGs and the validated manifest", () => {
    const files = visualArtifactRelativeFiles();
    expect(files).toHaveLength(8);
    expect(files.filter((filename) => filename.endsWith(".png"))).toHaveLength(7);
    expect(files).toContain("phase5a0d-manifest.json");
  });

  it("rejects a recomputed manifest that names a different fixture contract", () => {
    const original = visualManifest();
    const { manifestChecksum: _checksum, ...payload } = {
      ...original,
      fixtureContractChecksum: "c".repeat(64),
    };
    const tampered = { ...payload, manifestChecksum: checksum(payload) };
    expect(() => validateVisualBaselineManifest(tampered)).toThrow("manifest-schema-invalid");
  });
});
