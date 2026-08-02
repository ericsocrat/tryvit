import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { LIGHTHOUSE_ROUTES } from "../tooling/phase5a0d-contract";
import {
  LIGHTHOUSE_SOURCE_CONFIG_SHA256,
  aggregateLighthouseDirectory,
  canonicalLighthouseConfigSha256,
  compileLighthouseReport,
  computeLighthouseMetadataChecksum,
  expectedLighthouseEffectiveSettings,
  formatLighthouseReportMarkdown,
  lighthouseEmulatedUserAgent,
  serializeLighthouseReportJson,
  type LighthouseMode,
  type LighthouseProfile,
} from "../tooling/phase5a0d-lighthouse";

const temporaryDirectories: string[] = [];
const CHROMIUM_VERSION = "151.0.7922.34";

describe("Lighthouse source configuration identity", () => {
  it.each(["mobile", "desktop"] as const)(
    "attests unchanged %s configuration across LF and CRLF checkouts",
    (profile) => {
      const source = readFileSync(path.join(process.cwd(), `lighthouserc.${profile}.js`), "utf8");
      const lf = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
      const crlf = lf.replaceAll("\n", "\r\n");

      expect(canonicalLighthouseConfigSha256(lf)).toBe(LIGHTHOUSE_SOURCE_CONFIG_SHA256[profile]);
      expect(canonicalLighthouseConfigSha256(Buffer.from(crlf, "utf8"))).toBe(
        LIGHTHOUSE_SOURCE_CONFIG_SHA256[profile],
      );
    },
  );

  it("requires the guarded launcher to use canonical source checksums", () => {
    const launcher = readFileSync(
      path.join(process.cwd(), "e2e/scripts/visual-safety-cli.mts"),
      "utf8",
    );

    expect(launcher).toContain("canonicalLighthouseConfigSha256(readFileSync(sourcePath))");
    expect(launcher).not.toContain(
      'createHash("sha256").update(readFileSync(sourcePath)).digest("hex")',
    );
  });
});

function routesFor(mode: LighthouseMode) {
  return LIGHTHOUSE_ROUTES.filter(
    (route) => route.requiresLocalFixture === (mode === "local-authenticated"),
  ).map((route) => ({
    id: route.id,
    seoApplicable: route.seoApplicable,
    url: `http://127.0.0.1:3000${route.path.replace(":fixtureProductId", "42")}`,
  }));
}

function metadata(mode: LighthouseMode, profile: LighthouseProfile) {
  const withoutChecksum = {
    schemaVersion: "phase5a0d-lighthouse-run/v1" as const,
    sourceCommit: "a".repeat(40),
    mode,
    profile,
    runCount: 5,
    routes: routesFor(mode),
    buildId: mode === "public" ? "public-build" : "authenticated-build",
    buildFingerprint: mode === "public" ? "b".repeat(64) : "c".repeat(64),
    runtime: {
      node: "v22.21.1",
      lighthouse: "12.6.1" as const,
      chromium: CHROMIUM_VERSION,
    },
    sourceConfigSha256: LIGHTHOUSE_SOURCE_CONFIG_SHA256[profile],
    effectiveSettings: expectedLighthouseEffectiveSettings(profile, CHROMIUM_VERSION),
  };
  return {
    ...withoutChecksum,
    metadataChecksum: computeLighthouseMetadataChecksum(withoutChecksum),
  };
}

function lhr(
  url: string,
  profile: LighthouseProfile,
  overrides: {
    performance?: number;
    lcp?: number;
    cls?: number;
    tbt?: number;
    ttfb?: number;
    bytes?: number;
    finalUrl?: string;
  } = {},
) {
  const effective = expectedLighthouseEffectiveSettings(profile, CHROMIUM_VERSION);
  return {
    lighthouseVersion: "12.6.1",
    requestedUrl: url,
    finalUrl: overrides.finalUrl ?? url,
    environment: {
      networkUserAgent: lighthouseEmulatedUserAgent(profile, CHROMIUM_VERSION),
      hostUserAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36",
    },
    configSettings: effective,
    categories: {
      performance: { id: "performance", score: overrides.performance ?? 0.96 },
      accessibility: { id: "accessibility", score: 0.97 },
      "best-practices": { id: "best-practices", score: 0.92 },
      seo: { id: "seo", score: 0.96 },
    },
    audits: {
      "largest-contentful-paint": {
        numericValue: overrides.lcp ?? 2_000,
        numericUnit: "millisecond",
      },
      "cumulative-layout-shift": {
        numericValue: overrides.cls ?? 0.02,
        numericUnit: "unitless",
      },
      "total-blocking-time": {
        numericValue: overrides.tbt ?? 100,
        numericUnit: "millisecond",
      },
      "server-response-time": {
        numericValue: overrides.ttfb ?? 400,
        numericUnit: "millisecond",
      },
      "total-byte-weight": {
        numericValue: overrides.bytes ?? 800 * 1024,
        numericUnit: "byte",
      },
    },
  };
}

function results(mode: LighthouseMode, profile: LighthouseProfile) {
  return routesFor(mode).flatMap((route) =>
    [0, 1, 2, 3, 4].map((offset) =>
      lhr(route.url, profile, {
        performance: 0.96 - offset * 0.01,
        lcp: 2_000 + offset * 20,
      }),
    ),
  );
}

function writeSyntheticMatrix(): string {
  const root = mkdtempSync(path.join(tmpdir(), "phase5a0d-lighthouse-"));
  temporaryDirectories.push(root);
  for (const mode of ["public", "local-authenticated"] as const) {
    for (const profile of ["mobile", "desktop"] as const) {
      const directory = path.join(root, mode, profile);
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        path.join(directory, "phase5a0d-run-metadata.json"),
        JSON.stringify(metadata(mode, profile)),
      );
      results(mode, profile).forEach((report, index) =>
        writeFileSync(
          path.join(directory, `${String(index).padStart(2, "0")}.report.json`),
          JSON.stringify(report),
        ),
      );
      // The LHCI filesystem manifest is deliberately not interpreted as an LHR.
      writeFileSync(path.join(directory, "manifest.json"), JSON.stringify([]));
    }
  }
  return root;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Phase 5A.0d Lighthouse aggregation", () => {
  it("parses the exact four-directory route matrix and retains five samples", () => {
    const report = compileLighthouseReport(writeSyntheticMatrix());

    expect(report.routes).toHaveLength(10);
    expect(report.routes.map(({ id, mode, profile }) => `${mode}/${profile}/${id}`)).toEqual([
      "public/mobile/landing",
      "public/mobile/login",
      "public/mobile/contact",
      "public/desktop/landing",
      "public/desktop/login",
      "public/desktop/contact",
      "local-authenticated/mobile/app-shell",
      "local-authenticated/mobile/product-detail",
      "local-authenticated/desktop/app-shell",
      "local-authenticated/desktop/product-detail",
    ]);
    expect(report.routes[0].categoryScores.performance.values).toHaveLength(5);
    expect(report.routes[0].metrics.lcp).toMatchObject({
      minimum: 2_000,
      median: 2_040,
      maximum: 2_080,
      range: 80,
      medianAbsoluteDeviation: 20,
    });
    expect(report.evidence).toEqual({
      scope: "lab-only",
      inp: "unavailable-in-lighthouse-lab-evidence",
      fieldCoreWebVitals: "unavailable-no-field-data",
    });
    expect(report.passed).toBe(true);
  });

  it("rejects redirects, the wrong engine/profile, and anything but five reports", () => {
    const runMetadata = metadata("public", "mobile");
    const reports = results("public", "mobile");
    reports[0] = lhr(runMetadata.routes[0].url, "mobile", {
      finalUrl: "http://127.0.0.1:3000/auth/login",
    });
    expect(() => aggregateLighthouseDirectory(runMetadata, reports)).toThrow(
      "lhr-provenance-invalid:landing",
    );
    expect(() => aggregateLighthouseDirectory(runMetadata, reports.slice(1))).toThrow(
      "lhr-count-invalid",
    );

    const wrongProfile = structuredClone(results("public", "mobile"));
    wrongProfile[0].configSettings.screenEmulation.width = 390;
    expect(() => aggregateLighthouseDirectory(runMetadata, wrongProfile)).toThrow(
      "lhr-profile-settings-mismatch:screenEmulation",
    );
  });

  it("pins the desktop emulation to the launcher's Chromium-major Linux UA", () => {
    expect(lighthouseEmulatedUserAgent("desktop", CHROMIUM_VERSION)).toBe(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    );
  });

  it("validates config provenance and checksums before consuming LHR data", () => {
    const changedHash = { ...metadata("public", "mobile"), sourceConfigSha256: "d".repeat(64) };
    expect(() => aggregateLighthouseDirectory(changedHash, results("public", "mobile"))).toThrow(
      "metadata-contract-invalid",
    );
    const changedRuntime = structuredClone(metadata("public", "mobile"));
    changedRuntime.runtime.lighthouse = "13.0.0" as "12.6.1";
    expect(() => aggregateLighthouseDirectory(changedRuntime, results("public", "mobile"))).toThrow(
      "metadata-contract-invalid",
    );
    const tampered = structuredClone(metadata("public", "mobile"));
    tampered.buildId = "tampered";
    expect(() => aggregateLighthouseDirectory(tampered, results("public", "mobile"))).toThrow(
      "metadata-checksum-mismatch",
    );
  });

  it("keeps directional blueprint debt separate from blocking policy", () => {
    const runMetadata = metadata("public", "mobile");
    const reports = results("public", "mobile");
    for (const report of reports.filter(
      (candidate) => candidate.requestedUrl === runMetadata.routes[0].url,
    )) {
      report.categories.performance.score = 0.8;
      report.audits["largest-contentful-paint"].numericValue = 2_600;
    }
    const aggregate = aggregateLighthouseDirectory(runMetadata, reports).routes[0];
    expect(aggregate.blockingFailures).toEqual([]);
    expect(aggregate.directionalDebt).toEqual([
      "public/mobile/landing:blueprint:performance-median-below-0.9",
      "public/mobile/landing:blueprint:lcp-median-above-2500ms",
    ]);
  });

  it("reports timing and cold-mobile transfer debt for non-landing routes", () => {
    const runMetadata = metadata("local-authenticated", "mobile");
    const reports = results("local-authenticated", "mobile");
    const productUrl = runMetadata.routes.find((route) => route.id === "product-detail")!.url;
    for (const report of reports.filter((candidate) => candidate.requestedUrl === productUrl)) {
      report.audits["largest-contentful-paint"].numericValue = 2_600;
      report.audits["total-blocking-time"].numericValue = 201;
      report.audits["server-response-time"].numericValue = 801;
      report.audits["total-byte-weight"].numericValue = 901 * 1024;
    }

    const aggregate = aggregateLighthouseDirectory(runMetadata, reports).routes.find(
      (route) => route.id === "product-detail",
    )!;
    expect(aggregate.directionalDebt).toEqual([
      "local-authenticated/mobile/product-detail:blueprint:lcp-median-above-2500ms",
      "local-authenticated/mobile/product-detail:blueprint:tbt-median-above-200ms",
      "local-authenticated/mobile/product-detail:blueprint:ttfb-median-above-800ms",
      "local-authenticated/mobile/product-detail:blueprint:total-byte-weight-median-above-900KiB",
    ]);
  });

  it("makes threshold and instability failures blocking while using CLS maximum", () => {
    const runMetadata = metadata("local-authenticated", "desktop");
    const reports = results("local-authenticated", "desktop");
    const appReports = reports.filter(
      (candidate) => candidate.requestedUrl === runMetadata.routes[0].url,
    );
    [0.79, 0.8, 0.81, 0.92, 0.93].forEach((score, index) => {
      appReports[index].categories.performance.score = score;
    });
    appReports[4].audits["cumulative-layout-shift"].numericValue = 0.11;
    const aggregate = aggregateLighthouseDirectory(runMetadata, reports).routes[0];
    expect(aggregate.blockingFailures).toEqual([
      "local-authenticated/desktop/app-shell:category:performance:median-below-0.9",
      "local-authenticated/desktop/app-shell:metric:cls:maximum-above-0.1",
    ]);
    expect(aggregate.instabilityFailures).toContain(
      "local-authenticated/desktop/app-shell:performance-score-range-above-0.1",
    );
  });

  it("fails a positive timing metric when MAD exceeds twenty percent of median", () => {
    const runMetadata = metadata("public", "desktop");
    const reports = results("public", "desktop");
    const landingReports = reports.filter(
      (candidate) => candidate.requestedUrl === runMetadata.routes[0].url,
    );
    [100, 100, 200, 300, 300].forEach((value, index) => {
      landingReports[index].audits["server-response-time"].numericValue = value;
    });

    expect(
      aggregateLighthouseDirectory(runMetadata, reports).routes[0].instabilityFailures,
    ).toContain("public/desktop/landing:ttfb:mad-over-median-above-20-percent");
  });

  it("does not block on high relative variance when the absolute timing spread is noise", () => {
    const runMetadata = metadata("public", "desktop");
    const reports = results("public", "desktop");
    const landingReports = reports.filter(
      (candidate) => candidate.requestedUrl === runMetadata.routes[0].url,
    );
    [1, 1, 2, 3, 3].forEach((value, index) => {
      landingReports[index].audits["total-blocking-time"].numericValue = value;
    });

    const aggregate = aggregateLighthouseDirectory(runMetadata, reports).routes[0];
    expect(aggregate.metrics.tbt.madPercentOfMedian).toBe(50);
    expect(aggregate.metrics.tbt.medianAbsoluteDeviation).toBe(1);
    expect(aggregate.instabilityFailures).not.toContain(
      "public/desktop/landing:tbt:mad-over-median-above-20-percent",
    );
  });

  it("accepts credential-redacted retained LHR JSON and excludes fixture secrets", () => {
    const runMetadata = metadata("local-authenticated", "mobile");
    const reports = results("local-authenticated", "mobile");
    const secrets = [
      "fixture.user@example.test",
      "fixture-password-canary",
      "fixture-anon-key-canary",
      "fixture-service-role-canary",
    ];
    const credentialBearing = {
      ...reports[0],
      audits: {
        ...reports[0].audits,
        "script-treemap-data": {
          id: "script-treemap-data",
          details: { items: secrets.map((value) => ({ url: `data:text/plain,${value}` })) },
        },
      },
    };
    let retainedJson = JSON.stringify(credentialBearing);
    for (const secret of secrets) {
      retainedJson = retainedJson.replaceAll(secret, "[redacted-local-credential]");
    }
    reports[0] = JSON.parse(retainedJson);

    const aggregate = aggregateLighthouseDirectory(runMetadata, reports);
    const compact = JSON.stringify(aggregate.routes);
    expect(retainedJson).toContain("[redacted-local-credential]");
    for (const secret of secrets) expect(compact).not.toContain(secret);
    expect(compact).not.toContain("/app/product/42");
    expect(aggregate.routes).toHaveLength(2);
  });

  it("deletes HTML LHRs and redacts JSON before retaining metadata evidence", () => {
    const source = readFileSync(path.resolve("e2e/scripts/visual-safety-cli.mts"), "utf8");
    const sanitizer = source.slice(
      source.indexOf("function sanitizeLighthouseOutputDirectory("),
      source.indexOf("function lighthouseProfileSettings("),
    );
    expect(sanitizer).toContain('filename.endsWith(".report.html")');
    expect(sanitizer).toContain("unlinkSync(filename)");
    expect(sanitizer).toContain('filename.endsWith(".report.json")');
    expect(sanitizer).toContain("contents.replaceAll(value, replacement)");
    expect(sanitizer).toContain('path.resolve(frontendRoot, ".lighthouseci")');
    expect(sanitizer).toContain("rmSync(target, { recursive: true, force: false })");

    const childInvocation = source.lastIndexOf("code = await runChild(");
    const childFailureCapture = source.indexOf("lighthouseFailure =", childInvocation);
    const workingDirectoryCleanup = source.lastIndexOf("removeLighthouseWorkingDirectory()");
    const invocation = source.lastIndexOf("sanitizeLighthouseOutputDirectory(outputDirectory");
    expect(childInvocation).toBeGreaterThan(0);
    expect(childFailureCapture).toBeGreaterThan(childInvocation);
    expect(workingDirectoryCleanup).toBeGreaterThan(childFailureCapture);
    expect(workingDirectoryCleanup).toBeLessThan(invocation);
    expect(invocation).toBeGreaterThan(childFailureCapture);
    expect(invocation).toBeLessThan(source.lastIndexOf("const metadataWithoutChecksum"));
    expect(
      source.slice(childInvocation, source.lastIndexOf("const metadataWithoutChecksum")),
    ).toContain("if (lighthouseFailure)");

    const cleanupArmed = source.indexOf("localUserCleanupRequired = true");
    const userCreation = source.indexOf("await ensureTestUser()", cleanupArmed);
    const userCleanup = source.indexOf(
      "if (localUserCleanupRequired) await deleteTestUser()",
      userCreation,
    );
    expect(cleanupArmed).toBeGreaterThan(0);
    expect(userCreation).toBeGreaterThan(cleanupArmed);
    expect(userCleanup).toBeGreaterThan(userCreation);
  });

  it("renders compact deterministic JSON and Markdown without volatile paths or times", () => {
    const root = writeSyntheticMatrix();
    const sourceReport = path.join(root, "local-authenticated", "mobile", "00.report.json");
    const fixtureSecrets = [
      "fixture.user@example.test",
      "fixture-password-canary",
      "fixture-anon-key-canary",
      "fixture-service-role-canary",
    ];
    const credentialBearingLhr = JSON.parse(readFileSync(sourceReport, "utf8"));
    credentialBearingLhr.nonAuthoritativeDiagnostics = fixtureSecrets;
    writeFileSync(sourceReport, JSON.stringify(credentialBearingLhr));

    const report = compileLighthouseReport(root);
    const json = serializeLighthouseReportJson(report);
    const markdown = formatLighthouseReportMarkdown(report);

    expect(json).toBe(serializeLighthouseReportJson(report));
    expect(json).not.toContain("fetchTime");
    expect(json).not.toContain(tmpdir());
    expect(json.split("\n")).toHaveLength(2);
    expect(markdown).toContain(`Report checksum: \`${report.reportChecksum}\``);
    expect(markdown).toContain("lab-only; INP and field CWV unavailable");
    expect(markdown).not.toMatch(/field (?:pass|target met)|INP (?:pass|target met)/iu);
    expect(json).toContain('"inp":"unavailable-in-lighthouse-lab-evidence"');
    expect(json).toContain('"fieldCoreWebVitals":"unavailable-no-field-data"');
    expect(markdown).not.toContain(tmpdir());
    expect(json).not.toContain("/app/product/42");
    for (const secret of fixtureSecrets) {
      expect(json).not.toContain(secret);
      expect(markdown).not.toContain(secret);
    }
  });

  it("rejects non-authoritative CLI input and output paths before reading reports", () => {
    const cli = path.resolve("tooling/phase5a0d-lighthouse-cli.mts");
    const invoke = (...args: string[]) =>
      spawnSync(
        process.execPath,
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          cli,
          "aggregate",
          ...args,
        ],
        { cwd: process.cwd(), encoding: "utf8" },
      );

    const taintedRoot = invoke("--reports-directory=../lighthouse-reports");
    expect(taintedRoot.status).toBe(1);
    expect(taintedRoot.stderr).toContain("reports-directory-path-not-authorized");

    const taintedJson = invoke("--json=../stolen.json");
    expect(taintedJson.status).toBe(1);
    expect(taintedJson.stderr).toContain("json-output-path-not-authorized");

    const taintedMarkdown = invoke("--markdown=C:/tmp/report.md");
    expect(taintedMarkdown.status).toBe(1);
    expect(taintedMarkdown.stderr).toContain("markdown-output-path-not-authorized");
  });
});
