import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";

// Node's type-stripping loader requires the source extension at runtime.
// prettier-ignore
// @ts-expect-error TS5097: executed with `node --experimental-strip-types`.
import { LIGHTHOUSE_ROUTES, LIGHTHOUSE_RUN_COUNT, PHASE5A0D_SCHEMA_VERSION, assertRepresentativeRouteContract, summarizeNumbers, type NumericSummary } from "./phase5a0d-contract.ts";

export type LighthouseMode = "public" | "local-authenticated";
export type LighthouseProfile = "mobile" | "desktop";
export type LighthouseCategory = "performance" | "accessibility" | "best-practices" | "seo";
export type LighthouseMetric = "lcp" | "cls" | "tbt" | "ttfb" | "totalByteWeight";

export const LIGHTHOUSE_VERSION = "12.6.1" as const;
export const LIGHTHOUSE_SOURCE_CONFIG_SHA256 = Object.freeze({
  mobile: "29b7a7ac0dc3ce98633e1013f57486c878c33dd6271d9d7462e2f4804c32285e",
  desktop: "e2c2279410348292cb9744ad8cd12b75e2459a00a7eaba84f9ca36bb5db0ca9f",
});

/**
 * The reviewed source-config checksums predate repository LF normalization and
 * identify canonical CRLF text. Normalize only line endings so Linux and
 * Windows attest the same unchanged configuration without weakening content
 * integrity.
 */
export function canonicalLighthouseConfigSha256(source: Buffer | string): string {
  const canonical = source.toString().replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  return createHash("sha256").update(canonical.replaceAll("\n", "\r\n"), "utf8").digest("hex");
}

const APP_ORIGIN = "http://127.0.0.1:3000";
const CATEGORY_IDS: readonly LighthouseCategory[] = Object.freeze([
  "performance",
  "accessibility",
  "best-practices",
  "seo",
]);
const METRIC_AUDITS = Object.freeze({
  lcp: { id: "largest-contentful-paint", unit: "millisecond" },
  cls: { id: "cumulative-layout-shift", unit: "unitless" },
  tbt: { id: "total-blocking-time", unit: "millisecond" },
  ttfb: { id: "server-response-time", unit: "millisecond" },
  totalByteWeight: { id: "total-byte-weight", unit: "byte" },
} satisfies Record<LighthouseMetric, { readonly id: string; readonly unit: string }>);

const PROFILE_SETTINGS = Object.freeze({
  mobile: Object.freeze({
    formFactor: "mobile",
    throttlingMethod: "simulate",
    throttling: Object.freeze({
      rttMs: 150,
      throughputKbps: 1638.4,
      requestLatencyMs: 562.5,
      downloadThroughputKbps: 1474.56,
      uploadThroughputKbps: 675,
      cpuSlowdownMultiplier: 4,
    }),
    screenEmulation: Object.freeze({
      mobile: true,
      width: 412,
      height: 823,
      deviceScaleFactor: 1.75,
      disabled: false,
    }),
  }),
  desktop: Object.freeze({
    preset: "desktop",
    formFactor: "desktop",
    throttlingMethod: "simulate",
    throttling: Object.freeze({
      rttMs: 40,
      throughputKbps: 10_240,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
      cpuSlowdownMultiplier: 1,
    }),
    screenEmulation: Object.freeze({
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    }),
  }),
});

export function lighthouseEmulatedUserAgent(
  profile: LighthouseProfile,
  chromiumVersion: string,
): string {
  const match = /^(\d+)\.\d+\.\d+\.\d+$/u.exec(chromiumVersion);
  if (!match) fail("chromium-version-invalid");
  const chrome = `Chrome/${match[1]}.0.0.0`;
  return profile === "mobile"
    ? `Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) ${chrome} Mobile Safari/537.36`
    : `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ${chrome} Safari/537.36`;
}

interface LighthouseMetadataRoute {
  readonly id: string;
  readonly seoApplicable: boolean;
  readonly url: string;
}

export interface LighthouseRunMetadata {
  readonly schemaVersion: "phase5a0d-lighthouse-run/v1";
  readonly sourceCommit: string;
  readonly mode: LighthouseMode;
  readonly profile: LighthouseProfile;
  readonly runCount: number;
  readonly routes: readonly LighthouseMetadataRoute[];
  readonly buildId: string;
  readonly buildFingerprint: string;
  readonly runtime: {
    readonly node: string;
    readonly lighthouse: typeof LIGHTHOUSE_VERSION;
    readonly chromium: string;
  };
  readonly sourceConfigSha256: string;
  readonly effectiveSettings: Record<string, unknown>;
  readonly metadataChecksum: string;
}

export interface LighthouseRouteAggregate {
  readonly id: string;
  readonly path: string;
  readonly mode: LighthouseMode;
  readonly profile: LighthouseProfile;
  readonly categoryScores: Readonly<Record<LighthouseCategory, NumericSummary>>;
  readonly metrics: Readonly<Record<LighthouseMetric, NumericSummary>>;
  readonly blockingFailures: readonly string[];
  readonly instabilityFailures: readonly string[];
  readonly directionalDebt: readonly string[];
}

export interface LighthouseAggregateReport {
  readonly schemaVersion: number;
  readonly kind: "phase5a0d-lighthouse";
  readonly lighthouseVersion: typeof LIGHTHOUSE_VERSION;
  readonly runCount: typeof LIGHTHOUSE_RUN_COUNT;
  readonly evidence: {
    readonly scope: "lab-only";
    readonly inp: "unavailable-in-lighthouse-lab-evidence";
    readonly fieldCoreWebVitals: "unavailable-no-field-data";
  };
  readonly provenance: readonly {
    readonly mode: LighthouseMode;
    readonly profile: LighthouseProfile;
    readonly sourceCommit: string;
    readonly buildId: string;
    readonly buildFingerprint: string;
    readonly nodeVersion: string;
    readonly chromiumVersion: string;
    readonly sourceConfigSha256: string;
  }[];
  readonly routes: readonly LighthouseRouteAggregate[];
  readonly blockingFailures: readonly string[];
  readonly instabilityFailures: readonly string[];
  readonly directionalDebt: readonly string[];
  readonly passed: boolean;
  readonly reportChecksum: string;
}

interface LhrShape {
  readonly lighthouseVersion?: unknown;
  readonly requestedUrl?: unknown;
  readonly finalUrl?: unknown;
  readonly environment?: unknown;
  readonly configSettings?: unknown;
  readonly categories?: unknown;
  readonly audits?: unknown;
}

function fail(code: string): never {
  throw new Error(`[P5_LIGHTHOUSE] ${code}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sameJson(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

export function computeLighthouseMetadataChecksum(
  metadataWithoutChecksum: Omit<LighthouseRunMetadata, "metadataChecksum">,
): string {
  // This intentionally mirrors the launcher's insertion-ordered JSON checksum.
  return sha256(JSON.stringify(metadataWithoutChecksum));
}

export function computeLighthouseReportChecksum(
  reportWithoutChecksum: Omit<LighthouseAggregateReport, "reportChecksum">,
): string {
  return sha256(stableJson(reportWithoutChecksum));
}

export function expectedLighthouseEffectiveSettings(
  profile: LighthouseProfile,
  chromiumVersion: string,
): Record<string, unknown> {
  return {
    ...(profile === "desktop" ? { preset: "desktop" } : {}),
    onlyCategories: [...CATEGORY_IDS],
    ...PROFILE_SETTINGS[profile],
    emulatedUserAgent: lighthouseEmulatedUserAgent(profile, chromiumVersion),
    locale: "en-US",
    skipAudits: ["uses-http2"],
  };
}

function expectedRoutes(mode: LighthouseMode): typeof LIGHTHOUSE_ROUTES {
  return LIGHTHOUSE_ROUTES.filter(
    (route) => route.requiresLocalFixture === (mode === "local-authenticated"),
  );
}

function expectedConcretePath(routePath: string, url: URL): boolean {
  if (!routePath.includes(":fixtureProductId")) return url.pathname === routePath;
  return /^\/app\/product\/[1-9][0-9]*$/u.test(url.pathname);
}

function validateMetadataRoute(
  candidate: unknown,
  expected: (typeof LIGHTHOUSE_ROUTES)[number],
): asserts candidate is LighthouseMetadataRoute {
  if (!isRecord(candidate)) fail(`metadata-route-invalid:${expected.id}`);
  let url: URL;
  try {
    url = new URL(String(candidate.url));
  } catch {
    fail(`metadata-route-url-invalid:${expected.id}`);
  }
  if (
    candidate.id !== expected.id ||
    candidate.seoApplicable !== expected.seoApplicable ||
    url.origin !== APP_ORIGIN ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    !expectedConcretePath(expected.path, url)
  ) {
    fail(`metadata-route-mismatch:${expected.id}`);
  }
}

export function validateLighthouseRunMetadata(
  input: unknown,
  expectedMode?: LighthouseMode,
  expectedProfile?: LighthouseProfile,
): asserts input is LighthouseRunMetadata {
  if (!isRecord(input)) fail("metadata-invalid");
  const metadata = input as unknown as LighthouseRunMetadata;
  if (
    metadata.schemaVersion !== "phase5a0d-lighthouse-run/v1" ||
    (metadata.mode !== "public" && metadata.mode !== "local-authenticated") ||
    (metadata.profile !== "mobile" && metadata.profile !== "desktop") ||
    metadata.mode !== (expectedMode ?? metadata.mode) ||
    metadata.profile !== (expectedProfile ?? metadata.profile) ||
    metadata.runCount !== LIGHTHOUSE_RUN_COUNT ||
    !/^[0-9a-f]{40}$/u.test(metadata.sourceCommit) ||
    typeof metadata.buildId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/u.test(metadata.buildId) ||
    !/^[0-9a-f]{64}$/u.test(metadata.buildFingerprint) ||
    !isRecord(metadata.runtime) ||
    typeof metadata.runtime.node !== "string" ||
    !/^v?\d+\.\d+\.\d+(?:[-+].+)?$/u.test(metadata.runtime.node) ||
    metadata.runtime.lighthouse !== LIGHTHOUSE_VERSION ||
    typeof metadata.runtime.chromium !== "string" ||
    !/^\d+\.\d+\.\d+\.\d+$/u.test(metadata.runtime.chromium) ||
    metadata.sourceConfigSha256 !== LIGHTHOUSE_SOURCE_CONFIG_SHA256[metadata.profile] ||
    !isRecord(metadata.effectiveSettings) ||
    !sameJson(
      metadata.effectiveSettings,
      expectedLighthouseEffectiveSettings(metadata.profile, metadata.runtime.chromium),
    ) ||
    !Array.isArray(metadata.routes)
  ) {
    fail("metadata-contract-invalid");
  }
  const routes = expectedRoutes(metadata.mode);
  if (metadata.routes.length !== routes.length) fail("metadata-route-matrix-incomplete");
  routes.forEach((route, index) => validateMetadataRoute(metadata.routes[index], route));
  const { metadataChecksum, ...withoutChecksum } = metadata;
  if (
    typeof metadataChecksum !== "string" ||
    !/^[0-9a-f]{64}$/u.test(metadataChecksum) ||
    computeLighthouseMetadataChecksum(withoutChecksum) !== metadataChecksum
  ) {
    fail("metadata-checksum-mismatch");
  }
}

function numericAudit(lhr: LhrShape, metric: LighthouseMetric): number {
  if (!isRecord(lhr.audits)) fail(`audits-invalid:${metric}`);
  const contract = METRIC_AUDITS[metric];
  const audit = lhr.audits[contract.id];
  if (
    !isRecord(audit) ||
    typeof audit.numericValue !== "number" ||
    !Number.isFinite(audit.numericValue) ||
    audit.numericValue < 0 ||
    audit.numericUnit !== contract.unit
  ) {
    fail(`audit-invalid:${contract.id}`);
  }
  return audit.numericValue;
}

function categoryScore(lhr: LhrShape, category: LighthouseCategory): number {
  if (!isRecord(lhr.categories)) fail(`categories-invalid:${category}`);
  const value = lhr.categories[category];
  if (
    !isRecord(value) ||
    value.id !== category ||
    typeof value.score !== "number" ||
    !Number.isFinite(value.score) ||
    value.score < 0 ||
    value.score > 1
  ) {
    fail(`category-invalid:${category}`);
  }
  return value.score;
}

function validateProfileSettings(
  lhr: LhrShape,
  profile: LighthouseProfile,
  chromiumVersion: string,
): void {
  if (!isRecord(lhr.configSettings) || !isRecord(lhr.environment)) {
    fail("lhr-profile-settings-invalid");
  }
  const expected = PROFILE_SETTINGS[profile];
  for (const key of ["formFactor", "throttlingMethod", "throttling", "screenEmulation"] as const) {
    if (!sameJson(lhr.configSettings[key], expected[key])) {
      fail(`lhr-profile-settings-mismatch:${key}`);
    }
  }
  if (
    lhr.configSettings.locale !== "en-US" ||
    !sameJson(lhr.configSettings.onlyCategories, CATEGORY_IDS) ||
    !sameJson(lhr.configSettings.skipAudits, ["uses-http2"]) ||
    lhr.configSettings.emulatedUserAgent !==
      lighthouseEmulatedUserAgent(profile, chromiumVersion) ||
    lhr.environment.networkUserAgent !== lighthouseEmulatedUserAgent(profile, chromiumVersion)
  ) {
    fail("lhr-profile-settings-mismatch:common");
  }
  const chromiumMajor = chromiumVersion.split(".")[0];
  if (
    typeof lhr.environment.hostUserAgent !== "string" ||
    !new RegExp(`(?:Headless)?Chrome/${chromiumMajor}\\.`, "u").test(lhr.environment.hostUserAgent)
  ) {
    fail("lhr-host-user-agent-mismatch");
  }
}

export function validateLighthouseResult(
  input: unknown,
  route: LighthouseMetadataRoute,
  profile: LighthouseProfile,
  chromiumVersion: string,
): asserts input is LhrShape {
  if (!isRecord(input)) fail(`lhr-invalid:${route.id}`);
  const lhr = input as LhrShape;
  if (
    lhr.lighthouseVersion !== LIGHTHOUSE_VERSION ||
    lhr.requestedUrl !== route.url ||
    lhr.finalUrl !== route.url ||
    lhr.requestedUrl !== lhr.finalUrl
  ) {
    fail(`lhr-provenance-invalid:${route.id}`);
  }
  if (
    !isRecord(lhr.categories) ||
    !sameJson(Object.keys(lhr.categories).sort(), [...CATEGORY_IDS].sort())
  ) {
    fail(`lhr-category-matrix-invalid:${route.id}`);
  }
  validateProfileSettings(lhr, profile, chromiumVersion);
  CATEGORY_IDS.forEach((category) => categoryScore(lhr, category));
  (Object.keys(METRIC_AUDITS) as LighthouseMetric[]).forEach((metric) => numericAudit(lhr, metric));
}

function summarizeLhrs(
  lhrs: readonly LhrShape[],
  route: LighthouseMetadataRoute,
  mode: LighthouseMode,
  profile: LighthouseProfile,
  routePath: string,
): LighthouseRouteAggregate {
  const categoryScores = Object.fromEntries(
    CATEGORY_IDS.map((category) => [
      category,
      summarizeNumbers(lhrs.map((lhr) => categoryScore(lhr, category))),
    ]),
  ) as unknown as Record<LighthouseCategory, NumericSummary>;
  const metrics = Object.fromEntries(
    (Object.keys(METRIC_AUDITS) as LighthouseMetric[]).map((metric) => [
      metric,
      summarizeNumbers(lhrs.map((lhr) => numericAudit(lhr, metric))),
    ]),
  ) as unknown as Record<LighthouseMetric, NumericSummary>;
  const blockingFailures: string[] = [];
  const instabilityFailures: string[] = [];
  const directionalDebt: string[] = [];
  const prefix = `${mode}/${profile}/${route.id}`;
  const performanceMinimum = mode === "public" ? 0.75 : profile === "mobile" ? 0.85 : 0.9;
  const minimums: [LighthouseCategory, number][] = [
    ["performance", performanceMinimum],
    ["accessibility", 0.95],
    ["best-practices", 0.9],
  ];
  if (route.seoApplicable) minimums.push(["seo", 0.95]);
  for (const [category, minimum] of minimums) {
    if (categoryScores[category].median < minimum) {
      blockingFailures.push(`${prefix}:category:${category}:median-below-${minimum}`);
    }
  }
  if (metrics.cls.maximum > 0.1) {
    blockingFailures.push(`${prefix}:metric:cls:maximum-above-0.1`);
  }
  if (categoryScores.performance.range > 0.1) {
    instabilityFailures.push(`${prefix}:performance-score-range-above-0.1`);
  }
  for (const metric of ["lcp", "tbt", "ttfb"] as const) {
    const summary = metrics[metric];
    // Percentage variance becomes misleading near zero (for example, a TBT
    // median of 1.5 ms with a 0.5 ms MAD). Treat timing instability as
    // blocking only when both its relative and absolute spread are material.
    if (
      summary.median > 0 &&
      summary.medianAbsoluteDeviation >= 100 &&
      summary.madPercentOfMedian > 20
    ) {
      instabilityFailures.push(`${prefix}:${metric}:mad-over-median-above-20-percent`);
    }
  }
  if (route.id === "landing") {
    const performanceTarget = profile === "mobile" ? 0.9 : 0.95;
    const debtChecks: readonly [boolean, string][] = [
      [
        categoryScores.performance.median < performanceTarget,
        `performance-median-below-${performanceTarget}`,
      ],
      [metrics.lcp.median > 2_500, "lcp-median-above-2500ms"],
      [metrics.tbt.median > 200, "tbt-median-above-200ms"],
      [metrics.ttfb.median > 800, "ttfb-median-above-800ms"],
      [metrics.cls.median > 0.05, "cls-median-above-0.05"],
      [metrics.cls.maximum > 0.1, "cls-maximum-above-0.1"],
      [
        profile === "mobile" && metrics.totalByteWeight.median > 900 * 1024,
        "total-byte-weight-median-above-900KiB",
      ],
    ];
    for (const [failed, reason] of debtChecks) {
      if (failed) directionalDebt.push(`${prefix}:blueprint:${reason}`);
    }
  }
  return Object.freeze({
    id: route.id,
    path: routePath,
    mode,
    profile,
    categoryScores: Object.freeze(categoryScores),
    metrics: Object.freeze(metrics),
    blockingFailures: Object.freeze(blockingFailures),
    instabilityFailures: Object.freeze(instabilityFailures),
    directionalDebt: Object.freeze(directionalDebt),
  });
}

export function aggregateLighthouseDirectory(
  metadataInput: unknown,
  lhrInputs: readonly unknown[],
  expectedMode?: LighthouseMode,
  expectedProfile?: LighthouseProfile,
): {
  readonly metadata: LighthouseRunMetadata;
  readonly routes: readonly LighthouseRouteAggregate[];
} {
  validateLighthouseRunMetadata(metadataInput, expectedMode, expectedProfile);
  const metadata = metadataInput;
  const expectedCount = metadata.routes.length * LIGHTHOUSE_RUN_COUNT;
  if (lhrInputs.length !== expectedCount) {
    fail(`lhr-count-invalid:${metadata.mode}/${metadata.profile}`);
  }
  const routes = expectedRoutes(metadata.mode).map((contractRoute, index) => {
    const metadataRoute = metadata.routes[index];
    const routeLhrs = lhrInputs.filter(
      (input) => isRecord(input) && input.requestedUrl === metadataRoute.url,
    );
    if (routeLhrs.length !== LIGHTHOUSE_RUN_COUNT) {
      fail(`route-run-count-invalid:${metadata.mode}/${metadata.profile}/${contractRoute.id}`);
    }
    const validatedLhrs = routeLhrs.map((lhr) => {
      validateLighthouseResult(lhr, metadataRoute, metadata.profile, metadata.runtime.chromium);
      return lhr;
    });
    return summarizeLhrs(
      validatedLhrs,
      metadataRoute,
      metadata.mode,
      metadata.profile,
      contractRoute.path,
    );
  });
  return Object.freeze({ metadata, routes: Object.freeze(routes) });
}

function readJsonFile(file: string): unknown {
  let descriptor: number | undefined;
  let source: string;
  try {
    const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
    descriptor = openSync(file, constants.O_RDONLY | noFollow);
    const descriptorMetadata = fstatSync(descriptor, { bigint: true });
    const pathMetadata = lstatSync(file, { bigint: true });
    if (
      !descriptorMetadata.isFile() ||
      !pathMetadata.isFile() ||
      pathMetadata.isSymbolicLink() ||
      descriptorMetadata.dev !== pathMetadata.dev ||
      descriptorMetadata.ino !== pathMetadata.ino
    ) {
      fail("report-file-invalid");
    }
    source = readFileSync(descriptor, "utf8");
  } catch (error) {
    if (error instanceof Error && error.message === "[P5_LIGHTHOUSE] report-file-invalid") {
      throw error;
    }
    fail("report-file-invalid");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  try {
    return JSON.parse(source);
  } catch {
    fail("report-json-invalid");
  }
}

export function readLighthouseRunDirectory(
  reportsRoot: string,
  mode: LighthouseMode,
  profile: LighthouseProfile,
): ReturnType<typeof aggregateLighthouseDirectory> {
  const directory = path.join(reportsRoot, mode, profile);
  if (!existsSync(directory)) fail(`report-directory-missing:${mode}/${profile}`);
  const directoryMetadata = lstatSync(directory);
  if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
    fail(`report-directory-invalid:${mode}/${profile}`);
  }
  const metadataPath = path.join(directory, "phase5a0d-run-metadata.json");
  if (!existsSync(metadataPath)) fail(`metadata-missing:${mode}/${profile}`);
  const lhrFiles = readdirSync(directory)
    .filter((filename) => filename.endsWith(".report.json"))
    .sort();
  return aggregateLighthouseDirectory(
    readJsonFile(metadataPath),
    lhrFiles.map((filename) => readJsonFile(path.join(directory, filename))),
    mode,
    profile,
  );
}

export function compileLighthouseReport(reportsRoot: string): LighthouseAggregateReport {
  assertRepresentativeRouteContract();
  const modes: readonly LighthouseMode[] = ["public", "local-authenticated"];
  const profiles: readonly LighthouseProfile[] = ["mobile", "desktop"];
  const runs = modes.flatMap((mode) =>
    profiles.map((profile) => readLighthouseRunDirectory(reportsRoot, mode, profile)),
  );
  const sourceCommits = new Set(runs.map(({ metadata }) => metadata.sourceCommit));
  if (sourceCommits.size !== 1) fail("source-commit-mismatch");
  for (const runtimeKey of ["node", "lighthouse", "chromium"] as const) {
    if (new Set(runs.map(({ metadata }) => metadata.runtime[runtimeKey])).size !== 1) {
      fail(`runtime-mismatch:${runtimeKey}`);
    }
  }
  for (const mode of modes) {
    const modeRuns = runs.filter(({ metadata }) => metadata.mode === mode);
    if (
      new Set(modeRuns.map(({ metadata }) => metadata.buildId)).size !== 1 ||
      new Set(modeRuns.map(({ metadata }) => metadata.buildFingerprint)).size !== 1
    ) {
      fail(`build-provenance-mismatch:${mode}`);
    }
  }
  const routes = runs.flatMap((run) => run.routes);
  const blockingFailures = routes.flatMap((route) => route.blockingFailures);
  const instabilityFailures = routes.flatMap((route) => route.instabilityFailures);
  const directionalDebt = routes.flatMap((route) => route.directionalDebt);
  const withoutChecksum = {
    schemaVersion: PHASE5A0D_SCHEMA_VERSION,
    kind: "phase5a0d-lighthouse" as const,
    lighthouseVersion: LIGHTHOUSE_VERSION,
    runCount: LIGHTHOUSE_RUN_COUNT,
    evidence: {
      scope: "lab-only" as const,
      inp: "unavailable-in-lighthouse-lab-evidence" as const,
      fieldCoreWebVitals: "unavailable-no-field-data" as const,
    },
    provenance: runs.map(({ metadata }) => ({
      mode: metadata.mode,
      profile: metadata.profile,
      sourceCommit: metadata.sourceCommit,
      buildId: metadata.buildId,
      buildFingerprint: metadata.buildFingerprint,
      nodeVersion: metadata.runtime.node,
      chromiumVersion: metadata.runtime.chromium,
      sourceConfigSha256: metadata.sourceConfigSha256,
    })),
    routes,
    blockingFailures,
    instabilityFailures,
    directionalDebt,
    passed: blockingFailures.length === 0 && instabilityFailures.length === 0,
  };
  return Object.freeze({
    ...withoutChecksum,
    reportChecksum: computeLighthouseReportChecksum(withoutChecksum),
  });
}

export function serializeLighthouseReportJson(report: LighthouseAggregateReport): string {
  const { reportChecksum, ...withoutChecksum } = report;
  if (computeLighthouseReportChecksum(withoutChecksum) !== reportChecksum) {
    fail("report-checksum-mismatch");
  }
  return `${JSON.stringify(report)}\n`;
}

function formatNumber(value: number, digits = 2): string {
  return Number(value.toFixed(digits)).toString();
}

export function formatLighthouseReportMarkdown(report: LighthouseAggregateReport): string {
  const { reportChecksum, ...withoutChecksum } = report;
  if (computeLighthouseReportChecksum(withoutChecksum) !== reportChecksum) {
    fail("report-checksum-mismatch");
  }
  const lines = [
    "# Phase 5A.0d Lighthouse report",
    "",
    `Status: **${report.passed ? "PASS" : "FAIL"}** (lab-only; INP and field CWV unavailable)`,
    "",
    "| Route | Profile | Perf | A11y | BP | SEO | LCP ms | CLS med/max | TBT ms | TTFB ms | Transfer KiB |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const route of report.routes) {
    lines.push(
      `| ${route.id} | ${route.mode}/${route.profile} | ${formatNumber(route.categoryScores.performance.median)} | ${formatNumber(route.categoryScores.accessibility.median)} | ${formatNumber(route.categoryScores["best-practices"].median)} | ${formatNumber(route.categoryScores.seo.median)} | ${formatNumber(route.metrics.lcp.median, 1)} | ${formatNumber(route.metrics.cls.median, 3)}/${formatNumber(route.metrics.cls.maximum, 3)} | ${formatNumber(route.metrics.tbt.median, 1)} | ${formatNumber(route.metrics.ttfb.median, 1)} | ${formatNumber(route.metrics.totalByteWeight.median / 1024, 1)} |`,
    );
  }
  const sections: readonly [string, readonly string[]][] = [
    ["Blocking failures", report.blockingFailures],
    ["Instability failures", report.instabilityFailures],
    ["Directional blueprint debt", report.directionalDebt],
  ];
  for (const [title, items] of sections) {
    lines.push("", `## ${title}`, "");
    if (items.length === 0) lines.push("- None");
    else items.forEach((item) => lines.push(`- ${item}`));
  }
  lines.push("", `Report checksum: \`${reportChecksum}\``, "");
  return lines.join("\n");
}
