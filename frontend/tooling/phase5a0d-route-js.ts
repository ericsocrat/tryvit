import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import type { Page, Request, Response } from "@playwright/test";

// Node's type-stripping loader requires the source extension at runtime.
// prettier-ignore
// @ts-expect-error TS5097: executed with `node --experimental-strip-types`.
import { MEASUREMENT_ROUTES, PHASE5A0D_SCHEMA_VERSION, assertRepresentativeRouteContract, calculateRegression, resolveFixturePath, type MeasurementRoute } from "./phase5a0d-contract.ts";

type CaptureMode = "public" | "local-authenticated";

const TURNSTILE_STUB_BODY =
  "/* TryVit visual-safety: Cloudflare Turnstile intentionally contained. */";
const SPEED_INSIGHTS_STUB_BODY =
  "/* TryVit visual-safety: local Vercel Speed Insights intentionally contained. */";
const CONTAINMENT_MARKERS = Object.freeze([
  "contained-cloudflare-turnstile-exact-stub",
  "contained-local-vercel-speed-insights-inert",
] as const);
type ContainmentMarker = (typeof CONTAINMENT_MARKERS)[number];

export interface FixtureStateIdentity {
  readonly logicalIdentity:
    "phase5a0d-public-static-v1" | "phase5a0d-local-new-user-primary-product-v1";
  readonly stateChecksum: string;
}

const PUBLIC_FIXTURE_CONTRACT = Object.freeze({
  schema: "phase5a0d-route-fixture/v1",
  mode: "public",
  state: "static-no-database-fixture",
});
const LOCAL_FIXTURE_CONTRACT = Object.freeze({
  schema: "phase5a0d-route-fixture/v1",
  mode: "local-authenticated",
  userState: "new-user-no-product-history",
  product: Object.freeze({
    logicalIdentity: "qa-primary-dairy-product",
    country: "PL",
    brand: "QA Test Brand",
    productName: "QA Dairy Milk Gouda 45%",
  }),
});

export function routeFixtureStateForMode(mode: CaptureMode): FixtureStateIdentity {
  return Object.freeze(
    mode === "public"
      ? {
          logicalIdentity: "phase5a0d-public-static-v1" as const,
          stateChecksum: checksum(PUBLIC_FIXTURE_CONTRACT),
        }
      : {
          logicalIdentity: "phase5a0d-local-new-user-primary-product-v1" as const,
          stateChecksum: checksum(LOCAL_FIXTURE_CONTRACT),
        },
  );
}

export interface RuntimeJsAsset {
  readonly path: string;
  readonly rawBytes: number;
  readonly gzipBytes: number;
  readonly encodedBodyBytes: number | null;
  readonly decodedBodyBytes: number | null;
  readonly sha256: string;
}

export interface BrowserCaptureProfile {
  readonly id: "playwright-desktop-chrome-1440x900-light-reduced";
  readonly userAgent: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly deviceScaleFactor: number;
  readonly locale: string;
  readonly timezoneId: string;
  readonly colorScheme: "light";
  readonly reducedMotion: "reduce";
}

export interface RouteJsCapture {
  readonly schemaVersion: number;
  readonly kind: "phase5a0d-route-js-capture";
  readonly sourceCommit: string;
  readonly environmentClass: "ci-linux-authoritative" | "local-observation";
  readonly platform: string;
  readonly nodeVersion: string;
  readonly zlibVersion: string;
  readonly nextVersion: string;
  readonly chromiumVersion: string;
  readonly buildId: string;
  readonly buildFingerprint: string;
  readonly mode: CaptureMode;
  readonly fixtureState: FixtureStateIdentity;
  readonly browserProfile: BrowserCaptureProfile;
  readonly route: {
    readonly id: string;
    readonly label: string;
    readonly requestedPath: string;
    readonly finalPath: string;
    readonly boundary: MeasurementRoute["boundary"];
    readonly requiresLocalFixture: boolean;
  };
  readonly assets: readonly RuntimeJsAsset[];
  readonly containmentMarkers: readonly ContainmentMarker[];
  readonly captureChecksum: string;
}

export interface RouteJsMeasurement {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly mode: CaptureMode;
  readonly boundary: MeasurementRoute["boundary"];
  readonly requiresLocalFixture: boolean;
  readonly fixtureState: FixtureStateIdentity;
  readonly containmentMarkers: readonly ContainmentMarker[];
  readonly chunkCount: number;
  readonly rawBytes: number;
  readonly gzipBytes: number;
  readonly sharedGzipBytes: number;
  readonly routeOwnedGzipBytes: number;
  readonly encodedTransferBytes: number | null;
  readonly targetGzipBytes: number | null;
  readonly targetMet: boolean | null;
  readonly assets: readonly (RuntimeJsAsset & {
    readonly classification: "shared" | "route-owned";
    readonly routeUsageCount: number;
  })[];
}

export interface RouteJsModeReport {
  readonly schemaVersion: number;
  readonly kind: "phase5a0d-route-js-mode";
  readonly sourceCommit: string;
  readonly environmentClass: RouteJsCapture["environmentClass"];
  readonly platform: string;
  readonly nodeVersion: string;
  readonly zlibVersion: string;
  readonly nextVersion: string;
  readonly chromiumVersion: string;
  readonly mode: CaptureMode;
  readonly fixtureState: FixtureStateIdentity;
  readonly containmentMarkers: readonly ContainmentMarker[];
  readonly buildId: string;
  readonly buildFingerprint: string;
  readonly browserProfile: BrowserCaptureProfile;
  readonly compression: "gzip-level-9";
  readonly sourceOfTruth: "cold-browser-next-static-script-responses";
  readonly routeCount: number;
  readonly routes: readonly RouteJsMeasurement[];
  readonly reportChecksum: string;
}

export interface RouteJsReport {
  readonly schemaVersion: number;
  readonly kind: "phase5a0d-route-js";
  readonly sourceCommit: string;
  readonly environmentClass: RouteJsCapture["environmentClass"];
  readonly platform: string;
  readonly nodeVersion: string;
  readonly zlibVersion: string;
  readonly nextVersion: string;
  readonly chromiumVersion: string;
  readonly compression: "gzip-level-9";
  readonly sourceOfTruth: "cold-browser-next-static-script-responses";
  readonly sharedDefinition: "asset-observed-on-more-than-one-selected-route-in-the-same-runtime-mode";
  readonly routeCount: number;
  readonly uniqueChunkCount: number;
  readonly runtimeModes: readonly {
    readonly mode: CaptureMode;
    readonly buildId: string;
    readonly buildFingerprint: string;
    readonly browserProfile: BrowserCaptureProfile;
    readonly fixtureState: FixtureStateIdentity;
    readonly containmentMarkers: readonly ContainmentMarker[];
  }[];
  readonly routes: readonly RouteJsMeasurement[];
  readonly reportChecksum: string;
}

function fail(code: string): never {
  throw new Error(`[P5_BUNDLE] ${code}`);
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

function checksum(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function validateFixtureState(
  value: unknown,
  mode: CaptureMode,
): asserts value is FixtureStateIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("fixture-state-shape-invalid");
  }
  const actual = value as Partial<FixtureStateIdentity>;
  const expected = routeFixtureStateForMode(mode);
  if (
    actual.logicalIdentity !== expected.logicalIdentity ||
    actual.stateChecksum !== expected.stateChecksum
  ) {
    fail(`fixture-state-identity-invalid:${mode}`);
  }
}

function validateContainmentMarkers(value: unknown): asserts value is readonly ContainmentMarker[] {
  if (
    !Array.isArray(value) ||
    new Set(value).size !== value.length ||
    value.some((marker) => !CONTAINMENT_MARKERS.includes(marker as ContainmentMarker)) ||
    stableJson(value) !== stableJson([...value].sort())
  ) {
    fail("containment-markers-invalid");
  }
}

function readNextVersion(frontendRoot: string): string {
  const parsed = JSON.parse(
    readFileSync(path.join(frontendRoot, "node_modules", "next", "package.json"), "utf8"),
  ) as { version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    fail("next-version-unavailable");
  }
  return parsed.version;
}

function readGuardedBuildProvenance(
  frontendRoot: string,
  expected: {
    readonly sourceCommit: string;
    readonly buildId: string;
    readonly mode: CaptureMode;
    readonly appOrigin: string;
  },
): string {
  const provenancePath = path.join(frontendRoot, ".next", "tryvit-visual-safety-provenance.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(provenancePath, "utf8"));
  } catch {
    fail("guarded-build-provenance-unavailable");
  }
  const contract = (parsed as { contract?: Record<string, unknown> }).contract;
  if (
    !contract ||
    contract.sourceGitSha !== expected.sourceCommit ||
    contract.buildId !== expected.buildId ||
    contract.mode !== expected.mode ||
    contract.appOrigin !== expected.appOrigin ||
    typeof contract.fingerprint !== "string" ||
    !/^[0-9a-f]{64}$/u.test(contract.fingerprint)
  ) {
    fail("guarded-build-provenance-mismatch");
  }
  return contract.fingerprint;
}

export function normalizeRuntimeAssetPath(rawPath: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    fail("runtime-asset-percent-encoding-invalid");
  }
  const normalized = decoded.replaceAll("\\", "/");
  if (
    !normalized.startsWith("/_next/static/") ||
    !normalized.endsWith(".js") ||
    normalized.split("/").includes("..")
  ) {
    fail("runtime-asset-path-invalid");
  }
  return normalized;
}

function resolveRuntimeAsset(frontendRoot: string, rawPath: string): string {
  const normalized = normalizeRuntimeAssetPath(rawPath);
  const buildRoot = realpathSync.native(path.join(frontendRoot, ".next"));
  const relativeAsset = normalized.slice("/_next/".length);
  const lexical = path.resolve(buildRoot, ...relativeAsset.split("/"));
  const relative = path.relative(buildRoot, lexical);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail("runtime-asset-outside-build");
  }
  if (!existsSync(lexical) || !lstatSync(lexical).isFile()) {
    fail(`runtime-asset-unavailable:${normalized}`);
  }
  const resolved = realpathSync.native(lexical);
  const resolvedRelative = path.relative(buildRoot, resolved);
  if (
    resolvedRelative === ".." ||
    resolvedRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(resolvedRelative)
  ) {
    fail("runtime-asset-realpath-outside-build");
  }
  return resolved;
}

function routeForId(id: string): MeasurementRoute {
  const route = MEASUREMENT_ROUTES.find((candidate) => candidate.id === id);
  if (!route) fail(`route-not-authorized:${id}`);
  return route;
}

function routeMode(route: MeasurementRoute): CaptureMode {
  return route.requiresLocalFixture ? "local-authenticated" : "public";
}

function routePathMatches(route: MeasurementRoute, candidate: string): boolean {
  return candidate === route.path;
}

function validateBrowserProfile(value: unknown): asserts value is BrowserCaptureProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("browser-profile-shape-invalid");
  }
  const profile = value as Partial<BrowserCaptureProfile>;
  if (
    profile.id !== "playwright-desktop-chrome-1440x900-light-reduced" ||
    typeof profile.userAgent !== "string" ||
    profile.userAgent.length === 0 ||
    !profile.viewport ||
    profile.viewport.width !== 1440 ||
    profile.viewport.height !== 900 ||
    profile.deviceScaleFactor !== 1 ||
    profile.locale !== "en-US" ||
    profile.timezoneId !== "UTC" ||
    profile.colorScheme !== "light" ||
    profile.reducedMotion !== "reduce"
  ) {
    fail("browser-profile-invalid");
  }
}

function validateRuntimeAsset(value: unknown): asserts value is RuntimeJsAsset {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("runtime-asset-shape-invalid");
  }
  const asset = value as Partial<RuntimeJsAsset>;
  if (typeof asset.path !== "string") fail("runtime-asset-path-invalid");
  normalizeRuntimeAssetPath(asset.path);
  const transferValueValid = (candidate: unknown) =>
    candidate === null || (Number.isSafeInteger(candidate) && (candidate as number) > 0);
  if (
    !Number.isSafeInteger(asset.rawBytes) ||
    (asset.rawBytes ?? 0) <= 0 ||
    !Number.isSafeInteger(asset.gzipBytes) ||
    (asset.gzipBytes ?? 0) <= 0 ||
    !transferValueValid(asset.encodedBodyBytes) ||
    !transferValueValid(asset.decodedBodyBytes) ||
    typeof asset.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(asset.sha256)
  ) {
    fail("runtime-asset-fields-invalid");
  }
}

function validateEnvironmentFields(value: {
  readonly sourceCommit?: unknown;
  readonly environmentClass?: unknown;
  readonly platform?: unknown;
  readonly nodeVersion?: unknown;
  readonly zlibVersion?: unknown;
  readonly nextVersion?: unknown;
  readonly chromiumVersion?: unknown;
}): void {
  if (
    typeof value.sourceCommit !== "string" ||
    !/^[0-9a-f]{40}$/u.test(value.sourceCommit) ||
    (value.environmentClass !== "ci-linux-authoritative" &&
      value.environmentClass !== "local-observation") ||
    typeof value.platform !== "string" ||
    value.platform.length === 0 ||
    (value.environmentClass === "ci-linux-authoritative" && value.platform !== "linux") ||
    typeof value.nodeVersion !== "string" ||
    !/^v[0-9]+\./u.test(value.nodeVersion) ||
    typeof value.zlibVersion !== "string" ||
    value.zlibVersion.length === 0 ||
    typeof value.nextVersion !== "string" ||
    value.nextVersion.length === 0 ||
    typeof value.chromiumVersion !== "string" ||
    value.chromiumVersion.length === 0
  ) {
    fail("runtime-environment-invalid");
  }
}

function comparablePath(value: string): string {
  const withoutWindowsDevicePrefix =
    process.platform === "win32" && value.startsWith("\\\\?\\UNC\\")
      ? `\\\\${value.slice(8)}`
      : process.platform === "win32" && value.startsWith("\\\\?\\")
        ? value.slice(4)
        : value;
  const normalized = path.normalize(withoutWindowsDevicePrefix);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function assertPlainOwnedDirectory(directory: string, label: string): void {
  const metadata = lstatSync(directory);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    comparablePath(realpathSync.native(directory)) !== comparablePath(directory)
  ) {
    fail(`${label}-reparse`);
  }
}

function ensureOwnedDirectoryChain(frontendRoot: string, target: string): string {
  const lexicalFrontend = path.resolve(frontendRoot);
  const rootMetadata = lstatSync(lexicalFrontend);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) fail("frontend-root-reparse");
  const relative = path.relative(lexicalFrontend, path.resolve(target));
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    fail("capture-directory-not-owned");
  }
  let cursor = realpathSync.native(lexicalFrontend);
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) mkdirSync(cursor);
    assertPlainOwnedDirectory(cursor, "capture-directory");
  }
  return cursor;
}

function validateCapturePath(
  captureRoot: string,
  mode: CaptureMode,
  frontendRoot = process.cwd(),
): string {
  const expectedRoot = path.resolve(frontendRoot, "performance-reports", "route-js-captures");
  const resolved = path.resolve(captureRoot);
  if (resolved !== expectedRoot) fail("capture-root-not-owned");
  return ensureOwnedDirectoryChain(frontendRoot, path.join(resolved, mode));
}

export function resetRouteJsCaptureDirectory(
  captureRoot: string,
  mode: CaptureMode,
  frontendRoot = process.cwd(),
): void {
  const directory = validateCapturePath(captureRoot, mode, frontendRoot);
  assertPlainOwnedDirectory(directory, "capture-directory");
  rmSync(directory, { recursive: true, force: false });
  mkdirSync(directory);
  assertPlainOwnedDirectory(directory, "capture-directory");
}

type ScriptRequestKind =
  | "tracked-next-runtime"
  | "exact-turnstile-stub"
  | "exact-local-speed-insights-stub"
  | "unexpected-script";

function isTrackedRuntimeScript(rawUrl: string, expectedOrigin: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.origin === expectedOrigin &&
      parsed.pathname.startsWith("/_next/static/") &&
      parsed.pathname.endsWith(".js") &&
      parsed.search === "" &&
      parsed.hash === ""
    );
  } catch {
    return false;
  }
}

function isExactTurnstileScript(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const parameters = [...parsed.searchParams.entries()].sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
    );
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "challenges.cloudflare.com" &&
      parsed.port === "" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.pathname === "/turnstile/v0/api.js" &&
      parsed.hash === "" &&
      stableJson(parameters) ===
        stableJson([
          ["onload", "onloadTurnstileCallback"],
          ["render", "explicit"],
        ])
    );
  } catch {
    return false;
  }
}

function isExactLocalSpeedInsightsScript(rawUrl: string, expectedOrigin: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.origin === expectedOrigin &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.pathname === "/_vercel/speed-insights/script.js" &&
      parsed.search === "" &&
      parsed.hash === ""
    );
  } catch {
    return false;
  }
}

export function classifyRouteScriptRequest(
  rawUrl: string,
  expectedOrigin: string,
): ScriptRequestKind {
  if (isTrackedRuntimeScript(rawUrl, expectedOrigin)) return "tracked-next-runtime";
  if (isExactTurnstileScript(rawUrl)) return "exact-turnstile-stub";
  if (isExactLocalSpeedInsightsScript(rawUrl, expectedOrigin)) {
    return "exact-local-speed-insights-stub";
  }
  return "unexpected-script";
}

export function validateContainedScriptResponse(input: {
  readonly kind: Exclude<ScriptRequestKind, "tracked-next-runtime" | "unexpected-script">;
  readonly status: number;
  readonly contentType: string | undefined;
  readonly body: string;
}): ContainmentMarker {
  const expectedBody =
    input.kind === "exact-turnstile-stub" ? TURNSTILE_STUB_BODY : SPEED_INSIGHTS_STUB_BODY;
  const marker: ContainmentMarker =
    input.kind === "exact-turnstile-stub"
      ? "contained-cloudflare-turnstile-exact-stub"
      : "contained-local-vercel-speed-insights-inert";
  if (
    input.status !== 200 ||
    input.contentType?.toLowerCase() !== "application/javascript; charset=utf-8" ||
    input.body !== expectedBody
  ) {
    fail(`contained-script-response-invalid:${input.kind}`);
  }
  return marker;
}

async function assertNoErrorOrNotFoundShell(page: Page, routeId: string): Promise<void> {
  const rejectedShell = page.locator(
    '[data-testid="error-boundary-page"], img[data-illustration="not-found"], img[data-illustration="server-error"], [data-testid="empty-state"][data-variant="error"], [data-testid="empty-state"][data-variant="no-results"], next-error-h1',
  );
  if ((await rejectedShell.count()) > 0) fail(`route-error-or-not-found-shell:${routeId}`);
}

async function assertExactVisibleText(
  page: Page,
  selector: string,
  expectedText: string,
  routeId: string,
): Promise<void> {
  const target = page.locator(selector).first();
  try {
    await target.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    fail(`route-ready-marker-missing:${routeId}`);
  }
  if ((await target.textContent())?.trim() !== expectedText) {
    fail(`route-identity-mismatch:${routeId}`);
  }
}

async function assertStableRouteIdentity(
  page: Page,
  route: MeasurementRoute,
  requestedPath: string,
  expectedOrigin?: string,
): Promise<void> {
  const identity = route.stableIdentity;
  if (!identity) fail(`route-stable-identity-missing:${route.id}`);
  const currentUrl = new URL(page.url());
  if (
    (expectedOrigin !== undefined && currentUrl.origin !== expectedOrigin) ||
    currentUrl.pathname !== requestedPath ||
    currentUrl.pathname !== identity.pathname ||
    currentUrl.search !== "" ||
    currentUrl.hash !== ""
  ) {
    fail(`route-pathname-mismatch:${route.id}`);
  }
  const allMarkers = page.locator(`[${identity.markerAttribute}]`);
  const markerCount = await allMarkers.count();
  if (markerCount === 0) fail(`route-ready-marker-missing:${route.id}`);
  if (markerCount > 1) fail(`route-ready-marker-duplicate:${route.id}`);
  if ((await allMarkers.getAttribute(identity.markerAttribute)) !== identity.markerValue) {
    fail(`route-identity-mismatch:${route.id}`);
  }
  const markerSelector = `[${identity.markerAttribute}="${identity.markerValue}"]`;
  const boundary = page.locator(`${identity.boundarySelector}${markerSelector}`);
  if ((await boundary.count()) !== 1) fail(`route-identity-boundary-mismatch:${route.id}`);
  try {
    await boundary.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    fail(`route-ready-marker-missing:${route.id}`);
  }
}

export async function assertMeasuredRouteIdentity(
  page: Page,
  route: MeasurementRoute,
  requestedPath: string,
  expectedOrigin?: string,
): Promise<void> {
  await assertNoErrorOrNotFoundShell(page, route.id);
  if (route.id === "landing") {
    await assertStableRouteIdentity(page, route, requestedPath, expectedOrigin);
  } else if (route.id === "login") {
    await assertExactVisibleText(page, "#main-content h1", "Welcome back", route.id);
    for (const selector of ['form input#email[type="email"]', "form input#password"]) {
      try {
        await page.locator(selector).waitFor({ state: "visible", timeout: 15_000 });
      } catch {
        fail(`route-ready-marker-missing:${route.id}`);
      }
    }
  } else if (route.id === "contact") {
    await assertExactVisibleText(page, "main#main-content article h1", "Contact", route.id);
    const emailLink = page.locator('main#main-content a[href="mailto:hello@example.com"]');
    if ((await emailLink.count()) !== 1) fail(`route-identity-mismatch:${route.id}`);
  } else if (route.id === "app-shell") {
    const welcome = page.locator('[data-testid="new-user-welcome"]');
    try {
      await welcome.waitFor({ state: "visible", timeout: 15_000 });
    } catch {
      fail(`route-ready-marker-missing:${route.id}`);
    }
    for (const [testId, href] of [
      ["new-user-scan-cta", "/app/scan"],
      ["new-user-browse-cta", "/app/categories"],
    ] as const) {
      if ((await welcome.locator(`[data-testid="${testId}"][href="${href}"]`).count()) !== 1) {
        fail(`route-identity-mismatch:${route.id}`);
      }
    }
  } else if (route.id === "product-detail") {
    await assertExactVisibleText(page, "main h1", "QA Dairy Milk Gouda 45%", route.id);
    const brand = page.getByText("QA Test Brand", { exact: true });
    if ((await brand.count()) < 1) fail(`route-identity-mismatch:${route.id}`);
  } else {
    fail(`route-ready-contract-missing:${route.id}`);
  }
  await assertNoErrorOrNotFoundShell(page, route.id);
}

export async function captureRouteJavaScript(options: {
  readonly page: Page;
  readonly frontendRoot: string;
  readonly captureRoot: string;
  readonly mode: CaptureMode;
  readonly routeId: string;
  readonly fixtureProductId?: string;
  readonly appOrigin: string;
  readonly sourceCommit: string;
}): Promise<RouteJsCapture> {
  assertRepresentativeRouteContract();
  const route = routeForId(options.routeId);
  if (route.requiresLocalFixture !== (options.mode === "local-authenticated")) {
    fail(`route-mode-mismatch:${route.id}`);
  }
  const requestedPath = resolveFixturePath(route.path, options.fixtureProductId);
  if (!/^[0-9a-f]{40}$/u.test(options.sourceCommit)) fail("source-commit-invalid");
  const expectedOrigin = new URL(options.appOrigin);
  if (
    expectedOrigin.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(expectedOrigin.hostname) ||
    expectedOrigin.pathname !== "/"
  ) {
    fail("application-origin-not-loopback-http");
  }
  const observedResponses = new Set<string>();
  const containmentMarkers = new Set<ContainmentMarker>();
  const unexpectedScripts = new Set<string>();
  const observedScriptRequests = new Map<Request, ScriptRequestKind>();
  const terminalScriptRequests = new Set<Request>();
  const responseAudits = new Set<Promise<void>>();
  let lastTrackedResponseAt = 0;
  const onRequest = (request: Request) => {
    if (request.resourceType() !== "script") return;
    const kind = classifyRouteScriptRequest(request.url(), expectedOrigin.origin);
    observedScriptRequests.set(request, kind);
    if (kind === "unexpected-script") unexpectedScripts.add("unexpected-script-request");
  };
  const onRequestFailed = (request: Request) => {
    if (request.resourceType() !== "script") return;
    terminalScriptRequests.add(request);
    const kind =
      observedScriptRequests.get(request) ??
      classifyRouteScriptRequest(request.url(), expectedOrigin.origin);
    unexpectedScripts.add(`${kind}-request-failed`);
  };
  const onResponse = (response: Response) => {
    const request = response.request();
    if (request.resourceType() !== "script") return;
    terminalScriptRequests.add(request);
    const kind =
      observedScriptRequests.get(request) ??
      classifyRouteScriptRequest(response.url(), expectedOrigin.origin);
    if (!observedScriptRequests.has(request)) {
      unexpectedScripts.add("script-response-without-request-audit");
    }
    if (kind === "tracked-next-runtime") {
      if (!response.ok()) {
        unexpectedScripts.add(`same-origin-status-${response.status()}`);
        return;
      }
      observedResponses.add(normalizeRuntimeAssetPath(new URL(response.url()).pathname));
      lastTrackedResponseAt = Date.now();
      return;
    }
    if (kind === "exact-turnstile-stub" || kind === "exact-local-speed-insights-stub") {
      const audit = response
        .text()
        .then((body) => {
          containmentMarkers.add(
            validateContainedScriptResponse({
              kind,
              status: response.status(),
              contentType: response.headers()["content-type"],
              body,
            }),
          );
        })
        .catch(() => {
          unexpectedScripts.add(`contained-script-response-invalid:${kind}`);
        });
      responseAudits.add(audit);
      return;
    }
    unexpectedScripts.add(
      response.ok() ? "unexpected-script-executable-response" : "unexpected-script-response",
    );
  };
  options.page.on("request", onRequest);
  options.page.on("requestfailed", onRequestFailed);
  options.page.on("response", onResponse);
  let finalUrl: URL | undefined;
  try {
    // Enforce the audited media profile on the route page itself. A dependent
    // authentication setup project can otherwise leave Chromium reporting its
    // host preference even though the measurement project declares `reduce`.
    await options.page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    const navigation = await options.page.goto(requestedPath, { waitUntil: "domcontentloaded" });
    if (!navigation?.ok()) fail(`route-navigation-failed:${route.id}`);
    await options.page.waitForLoadState("load", { timeout: 15_000 });
    await options.page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map(async (image) => {
          if (image.complete) return;
          await image.decode().catch(() => undefined);
        }),
      );
    });
    await assertMeasuredRouteIdentity(options.page, route, requestedPath, expectedOrigin.origin);
    const settleDeadline = Date.now() + 15_000;
    while (observedResponses.size === 0 || Date.now() - lastTrackedResponseAt < 750) {
      if (Date.now() >= settleDeadline) fail(`tracked-script-settle-timeout:${route.id}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await Promise.all([...responseAudits]);
    for (const request of observedScriptRequests.keys()) {
      if (!terminalScriptRequests.has(request)) {
        unexpectedScripts.add("script-request-terminal-event-missing");
      }
    }
    finalUrl = new URL(options.page.url());
  } finally {
    options.page.off("request", onRequest);
    options.page.off("requestfailed", onRequestFailed);
    options.page.off("response", onResponse);
  }
  if (!finalUrl) fail(`route-navigation-final-url-missing:${route.id}`);
  if (unexpectedScripts.size > 0) {
    fail(`unexpected-script-response:${[...unexpectedScripts].sort().join(",")}`);
  }
  if (
    finalUrl.origin !== expectedOrigin.origin ||
    finalUrl.pathname !== requestedPath ||
    finalUrl.search !== "" ||
    finalUrl.hash !== ""
  ) {
    fail(`route-attribution-redirected:${route.id}`);
  }
  const timingEntries = await options.page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter(
        (entry): entry is PerformanceResourceTiming =>
          "encodedBodySize" in entry && "decodedBodySize" in entry,
      )
      .map((entry) => ({
        url: entry.name,
        encodedBodyBytes: entry.encodedBodySize,
        decodedBodyBytes: entry.decodedBodySize,
      })),
  );
  for (const entry of timingEntries) {
    if (isTrackedRuntimeScript(entry.url, expectedOrigin.origin)) {
      observedResponses.add(normalizeRuntimeAssetPath(new URL(entry.url).pathname));
    }
  }
  const timingByPath = new Map(
    timingEntries
      .filter((entry) => isTrackedRuntimeScript(entry.url, expectedOrigin.origin))
      .map((entry) => [normalizeRuntimeAssetPath(new URL(entry.url).pathname), entry]),
  );
  const assets = [...observedResponses]
    .map(normalizeRuntimeAssetPath)
    .sort()
    .map((assetPath): RuntimeJsAsset => {
      const bytes = readFileSync(resolveRuntimeAsset(options.frontendRoot, assetPath));
      const timing = timingByPath.get(assetPath);
      return Object.freeze({
        path: assetPath,
        rawBytes: bytes.byteLength,
        gzipBytes: gzipSync(bytes, { level: 9 }).byteLength,
        encodedBodyBytes: timing && timing.encodedBodyBytes > 0 ? timing.encodedBodyBytes : null,
        decodedBodyBytes: timing && timing.decodedBodyBytes > 0 ? timing.decodedBodyBytes : null,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    });
  if (assets.length === 0 || assets.every((asset) => asset.gzipBytes === 0)) {
    fail(`false-zero-runtime-measurement:${route.id}`);
  }
  const buildId = readFileSync(path.join(options.frontendRoot, ".next", "BUILD_ID"), "utf8").trim();
  if (!/^[A-Za-z0-9_-]+$/u.test(buildId)) fail("build-id-unavailable");
  const buildFingerprint = readGuardedBuildProvenance(options.frontendRoot, {
    sourceCommit: options.sourceCommit,
    buildId,
    mode: options.mode,
    appOrigin: expectedOrigin.origin,
  });
  const environmentClass: RouteJsCapture["environmentClass"] =
    process.env.CI === "true" && process.platform === "linux"
      ? "ci-linux-authoritative"
      : "local-observation";
  const chromiumVersion = options.page.context().browser()?.version();
  if (!chromiumVersion) fail("chromium-version-unavailable");
  const browserState = await options.page.evaluate(() => ({
    userAgent: navigator.userAgent,
    locale: navigator.language,
    timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
    deviceScaleFactor: window.devicePixelRatio,
    colorScheme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "reduce"
      : "no-preference",
  }));
  const viewport = options.page.viewportSize();
  if (!viewport) fail("browser-profile-mismatch:viewport-unavailable");
  const profileMismatches = [
    viewport.width !== 1440 || viewport.height !== 900 ? "viewport" : null,
    browserState.deviceScaleFactor !== 1 ? "device-scale-factor" : null,
    browserState.locale !== "en-US" ? "locale" : null,
    browserState.timezoneId !== "UTC" ? "timezone" : null,
    browserState.colorScheme !== "light" ? "color-scheme" : null,
    browserState.reducedMotion !== "reduce" ? "reduced-motion" : null,
  ].filter((value): value is string => value !== null);
  if (profileMismatches.length > 0) {
    fail(`browser-profile-mismatch:${profileMismatches.join(",")}`);
  }
  const browserProfile: BrowserCaptureProfile = Object.freeze({
    id: "playwright-desktop-chrome-1440x900-light-reduced",
    userAgent: browserState.userAgent,
    viewport: Object.freeze(viewport),
    deviceScaleFactor: browserState.deviceScaleFactor,
    locale: browserState.locale,
    timezoneId: browserState.timezoneId,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const withoutChecksum = {
    schemaVersion: PHASE5A0D_SCHEMA_VERSION,
    kind: "phase5a0d-route-js-capture" as const,
    sourceCommit: options.sourceCommit,
    environmentClass,
    platform: process.platform,
    nodeVersion: process.version,
    zlibVersion: process.versions.zlib,
    nextVersion: readNextVersion(options.frontendRoot),
    chromiumVersion,
    buildId,
    buildFingerprint,
    mode: options.mode,
    fixtureState: routeFixtureStateForMode(options.mode),
    browserProfile,
    route: {
      id: route.id,
      label: route.label,
      requestedPath: route.path,
      finalPath: route.path,
      boundary: route.boundary,
      requiresLocalFixture: route.requiresLocalFixture,
    },
    assets: Object.freeze(assets),
    containmentMarkers: Object.freeze([...containmentMarkers].sort()),
  };
  const capture = Object.freeze({
    ...withoutChecksum,
    captureChecksum: checksum(withoutChecksum),
  });
  const modeDirectory = validateCapturePath(
    options.captureRoot,
    options.mode,
    options.frontendRoot,
  );
  const outputFile = path.join(modeDirectory, `${route.id}.json`);
  let descriptor: number | undefined;
  try {
    const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
    descriptor = openSync(outputFile, constants.O_WRONLY | constants.O_CREAT | noFollow, 0o600);
    const descriptorMetadata = fstatSync(descriptor, { bigint: true });
    const pathMetadata = lstatSync(outputFile, { bigint: true });
    if (
      !descriptorMetadata.isFile() ||
      !pathMetadata.isFile() ||
      pathMetadata.isSymbolicLink() ||
      descriptorMetadata.dev !== pathMetadata.dev ||
      descriptorMetadata.ino !== pathMetadata.ino ||
      comparablePath(realpathSync.native(outputFile)) !== comparablePath(outputFile)
    ) {
      fail("capture-output-invalid");
    }
    ftruncateSync(descriptor, 0);
    writeFileSync(descriptor, `${JSON.stringify(capture, null, 2)}\n`, "utf8");
  } catch (error) {
    if (error instanceof Error && error.message === "[P5_BUNDLE] capture-output-invalid") {
      throw error;
    }
    fail("capture-output-invalid");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return capture;
}

export function validateRouteJsCapture(value: unknown): asserts value is RouteJsCapture {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("capture-shape-invalid");
  const capture = value as Partial<RouteJsCapture>;
  if (
    capture.schemaVersion !== PHASE5A0D_SCHEMA_VERSION ||
    capture.kind !== "phase5a0d-route-js-capture" ||
    !capture.route ||
    !Array.isArray(capture.assets) ||
    capture.assets.length === 0 ||
    !Array.isArray(capture.containmentMarkers) ||
    "containedExternalScripts" in capture ||
    typeof capture.captureChecksum !== "string"
  ) {
    fail("capture-schema-invalid");
  }
  validateEnvironmentFields(capture);
  if (
    typeof capture.route.id !== "string" ||
    (capture.mode !== "public" && capture.mode !== "local-authenticated") ||
    typeof capture.buildId !== "string" ||
    !/^[A-Za-z0-9_-]+$/u.test(capture.buildId) ||
    typeof capture.buildFingerprint !== "string" ||
    !/^[0-9a-f]{64}$/u.test(capture.buildFingerprint)
  ) {
    fail("capture-identity-invalid");
  }
  validateFixtureState(capture.fixtureState, capture.mode);
  validateBrowserProfile(capture.browserProfile);
  const route = routeForId(capture.route.id);
  if (
    capture.mode !== routeMode(route) ||
    capture.route.label !== route.label ||
    capture.route.boundary !== route.boundary ||
    capture.route.requiresLocalFixture !== route.requiresLocalFixture ||
    typeof capture.route.requestedPath !== "string" ||
    !routePathMatches(route, capture.route.requestedPath) ||
    capture.route.finalPath !== capture.route.requestedPath
  ) {
    fail(`capture-route-contract-invalid:${route.id}`);
  }
  const paths = new Set<string>();
  for (const asset of capture.assets) {
    validateRuntimeAsset(asset);
    if (paths.has(asset.path)) fail("capture-asset-path-duplicate");
    paths.add(asset.path);
  }
  validateContainmentMarkers(capture.containmentMarkers);
  const { captureChecksum, ...withoutChecksum } = capture as RouteJsCapture;
  if (checksum(withoutChecksum) !== captureChecksum) fail("capture-checksum-mismatch");
}

export function compileModeReport(
  values: readonly unknown[],
  mode: CaptureMode,
): RouteJsModeReport {
  const captures = values.map((value) => {
    validateRouteJsCapture(value);
    return value;
  });
  const expected = MEASUREMENT_ROUTES.filter(
    (route) => route.requiresLocalFixture === (mode === "local-authenticated"),
  );
  if (
    captures.length !== expected.length ||
    expected.some((route) => !captures.some((capture) => capture.route.id === route.id))
  ) {
    fail(`capture-route-set-incomplete:${mode}`);
  }
  const identity = captures[0];
  if (
    captures.some(
      (capture) =>
        capture.mode !== mode ||
        capture.sourceCommit !== identity.sourceCommit ||
        capture.environmentClass !== identity.environmentClass ||
        capture.platform !== identity.platform ||
        capture.nodeVersion !== identity.nodeVersion ||
        capture.zlibVersion !== identity.zlibVersion ||
        capture.nextVersion !== identity.nextVersion ||
        capture.chromiumVersion !== identity.chromiumVersion ||
        capture.buildId !== identity.buildId ||
        capture.buildFingerprint !== identity.buildFingerprint ||
        stableJson(capture.fixtureState) !== stableJson(identity.fixtureState) ||
        stableJson(capture.browserProfile) !== stableJson(identity.browserProfile),
    )
  ) {
    fail(`capture-runtime-identity-mismatch:${mode}`);
  }
  const usage = new Map<string, Set<string>>();
  const assetIdentity = new Map<string, RuntimeJsAsset>();
  for (const capture of captures) {
    for (const asset of capture.assets) {
      const known = assetIdentity.get(asset.path);
      if (
        known &&
        (known.sha256 !== asset.sha256 ||
          known.rawBytes !== asset.rawBytes ||
          known.gzipBytes !== asset.gzipBytes)
      ) {
        fail(`capture-asset-identity-conflict:${asset.path}`);
      }
      assetIdentity.set(asset.path, asset);
      const routes = usage.get(asset.path) ?? new Set<string>();
      routes.add(capture.route.id);
      usage.set(asset.path, routes);
    }
  }
  const routes = expected.map((route): RouteJsMeasurement => {
    const capture = captures.find((candidate) => candidate.route.id === route.id) as RouteJsCapture;
    const assets = capture.assets.map((asset) => {
      const routeUsageCount = usage.get(asset.path)?.size ?? 0;
      if (routeUsageCount < 1) fail("capture-route-usage-unavailable");
      return Object.freeze({
        ...asset,
        classification: (routeUsageCount > 1 ? "shared" : "route-owned") as
          "shared" | "route-owned",
        routeUsageCount,
      });
    });
    const gzipBytes = assets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
    const sharedGzipBytes = assets
      .filter((asset) => asset.classification === "shared")
      .reduce((sum, asset) => sum + asset.gzipBytes, 0);
    const transferValues = assets.map((asset) => asset.encodedBodyBytes);
    return Object.freeze({
      id: route.id,
      label: route.label,
      path: capture.route.requestedPath,
      mode,
      boundary: route.boundary,
      requiresLocalFixture: route.requiresLocalFixture,
      fixtureState: capture.fixtureState,
      containmentMarkers: capture.containmentMarkers,
      chunkCount: assets.length,
      rawBytes: assets.reduce((sum, asset) => sum + asset.rawBytes, 0),
      gzipBytes,
      sharedGzipBytes,
      routeOwnedGzipBytes: gzipBytes - sharedGzipBytes,
      encodedTransferBytes: transferValues.every((value) => value !== null)
        ? (transferValues as number[]).reduce((sum, value) => sum + value, 0)
        : null,
      targetGzipBytes: route.initialJsTargetGzipBytes,
      targetMet:
        route.initialJsTargetGzipBytes === null
          ? null
          : gzipBytes <= route.initialJsTargetGzipBytes,
      assets: Object.freeze(assets),
    });
  });
  const withoutChecksum = {
    schemaVersion: PHASE5A0D_SCHEMA_VERSION,
    kind: "phase5a0d-route-js-mode" as const,
    sourceCommit: identity.sourceCommit,
    environmentClass: identity.environmentClass,
    platform: identity.platform,
    nodeVersion: identity.nodeVersion,
    zlibVersion: identity.zlibVersion,
    nextVersion: identity.nextVersion,
    chromiumVersion: identity.chromiumVersion,
    mode,
    fixtureState: identity.fixtureState,
    containmentMarkers: Object.freeze(
      [...new Set(captures.flatMap((capture) => capture.containmentMarkers))].sort(),
    ),
    buildId: identity.buildId,
    buildFingerprint: identity.buildFingerprint,
    browserProfile: identity.browserProfile,
    compression: "gzip-level-9" as const,
    sourceOfTruth: "cold-browser-next-static-script-responses" as const,
    routeCount: routes.length,
    routes: Object.freeze(routes),
  };
  return Object.freeze({ ...withoutChecksum, reportChecksum: checksum(withoutChecksum) });
}

function validateRouteMeasurements(values: readonly RouteJsMeasurement[], mode: CaptureMode): void {
  const expected = MEASUREMENT_ROUTES.filter((route) => routeMode(route) === mode);
  if (
    values.length !== expected.length ||
    new Set(values.map((route) => route.id)).size !== expected.length
  ) {
    fail(`measurement-route-set-invalid:${mode}`);
  }
  const usage = new Map<string, Set<string>>();
  const identity = new Map<string, RuntimeJsAsset>();
  for (const measurement of values) {
    const route = routeForId(measurement.id);
    if (routeMode(route) !== mode) fail(`measurement-route-mode-invalid:${route.id}`);
    const paths = new Set<string>();
    for (const asset of measurement.assets) {
      validateRuntimeAsset(asset);
      if (paths.has(asset.path)) fail("measurement-asset-path-duplicate");
      paths.add(asset.path);
      const known = identity.get(asset.path);
      if (
        known &&
        (known.sha256 !== asset.sha256 ||
          known.rawBytes !== asset.rawBytes ||
          known.gzipBytes !== asset.gzipBytes)
      ) {
        fail(`measurement-asset-identity-conflict:${asset.path}`);
      }
      identity.set(asset.path, asset);
      const routes = usage.get(asset.path) ?? new Set<string>();
      routes.add(measurement.id);
      usage.set(asset.path, routes);
    }
  }
  for (const route of expected) {
    const measurement = values.find((candidate) => candidate.id === route.id);
    if (!measurement) fail(`measurement-route-missing:${route.id}`);
    validateFixtureState(measurement.fixtureState, mode);
    validateContainmentMarkers(measurement.containmentMarkers);
    const expectedTarget = route.initialJsTargetGzipBytes;
    const expectedTargetMet =
      expectedTarget === null ? null : measurement.gzipBytes <= expectedTarget;
    if (
      measurement.label !== route.label ||
      measurement.mode !== mode ||
      measurement.boundary !== route.boundary ||
      measurement.requiresLocalFixture !== route.requiresLocalFixture ||
      !routePathMatches(route, measurement.path) ||
      measurement.targetGzipBytes !== expectedTarget ||
      measurement.targetMet !== expectedTargetMet ||
      measurement.chunkCount !== measurement.assets.length ||
      measurement.assets.length === 0
    ) {
      fail(`measurement-route-contract-invalid:${route.id}`);
    }
    let rawBytes = 0;
    let gzipBytes = 0;
    let sharedGzipBytes = 0;
    let routeOwnedGzipBytes = 0;
    const transferValues: number[] = [];
    let transferComplete = true;
    for (const asset of measurement.assets) {
      const usageCount = usage.get(asset.path)?.size ?? 0;
      const classification = usageCount > 1 ? "shared" : "route-owned";
      if (asset.routeUsageCount !== usageCount || asset.classification !== classification) {
        fail(`measurement-classification-invalid:${route.id}`);
      }
      rawBytes += asset.rawBytes;
      gzipBytes += asset.gzipBytes;
      if (classification === "shared") sharedGzipBytes += asset.gzipBytes;
      else routeOwnedGzipBytes += asset.gzipBytes;
      if (asset.encodedBodyBytes === null) transferComplete = false;
      else transferValues.push(asset.encodedBodyBytes);
    }
    const encodedTransferBytes = transferComplete
      ? transferValues.reduce((sum, value) => sum + value, 0)
      : null;
    if (
      measurement.rawBytes !== rawBytes ||
      measurement.gzipBytes !== gzipBytes ||
      measurement.sharedGzipBytes !== sharedGzipBytes ||
      measurement.routeOwnedGzipBytes !== routeOwnedGzipBytes ||
      measurement.encodedTransferBytes !== encodedTransferBytes
    ) {
      fail(`measurement-total-invalid:${route.id}`);
    }
  }
}

export function validateRouteJsModeReport(value: unknown): asserts value is RouteJsModeReport {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("mode-report-shape-invalid");
  const report = value as Partial<RouteJsModeReport>;
  if (
    report.schemaVersion !== PHASE5A0D_SCHEMA_VERSION ||
    report.kind !== "phase5a0d-route-js-mode" ||
    !Array.isArray(report.routes) ||
    report.routes.length === 0 ||
    (report.mode !== "public" && report.mode !== "local-authenticated") ||
    report.compression !== "gzip-level-9" ||
    report.sourceOfTruth !== "cold-browser-next-static-script-responses" ||
    typeof report.reportChecksum !== "string"
  ) {
    fail("mode-report-schema-invalid");
  }
  validateEnvironmentFields(report);
  if (
    typeof report.buildId !== "string" ||
    !/^[A-Za-z0-9_-]+$/u.test(report.buildId) ||
    typeof report.buildFingerprint !== "string" ||
    !/^[0-9a-f]{64}$/u.test(report.buildFingerprint) ||
    report.routeCount !== report.routes.length
  ) {
    fail("mode-report-identity-invalid");
  }
  validateFixtureState(report.fixtureState, report.mode);
  validateContainmentMarkers(report.containmentMarkers);
  validateBrowserProfile(report.browserProfile);
  validateRouteMeasurements(report.routes, report.mode);
  const expectedContainmentMarkers = [
    ...new Set(report.routes.flatMap((route) => route.containmentMarkers)),
  ].sort();
  if (stableJson(report.containmentMarkers) !== stableJson(expectedContainmentMarkers)) {
    fail("mode-report-containment-markers-mismatch");
  }
  const { reportChecksum, ...withoutChecksum } = report as RouteJsModeReport;
  if (checksum(withoutChecksum) !== reportChecksum) fail("mode-report-checksum-mismatch");
}

export function combineModeReports(values: readonly unknown[]): RouteJsReport {
  if (values.length !== 2) fail("two-mode-reports-required");
  const reports = values.map((value) => {
    validateRouteJsModeReport(value);
    return value;
  });
  const publicReport = reports.find((report) => report.mode === "public");
  const authReport = reports.find((report) => report.mode === "local-authenticated");
  if (!publicReport || !authReport) fail("public-and-local-authenticated-reports-required");
  if (
    publicReport.sourceCommit !== authReport.sourceCommit ||
    publicReport.environmentClass !== authReport.environmentClass ||
    publicReport.platform !== authReport.platform ||
    publicReport.nodeVersion !== authReport.nodeVersion ||
    publicReport.zlibVersion !== authReport.zlibVersion ||
    publicReport.nextVersion !== authReport.nextVersion ||
    publicReport.chromiumVersion !== authReport.chromiumVersion
  ) {
    fail("mode-report-runtime-identity-mismatch");
  }
  const routes = [...publicReport.routes, ...authReport.routes].sort(
    (left, right) =>
      MEASUREMENT_ROUTES.findIndex((route) => route.id === left.id) -
      MEASUREMENT_ROUTES.findIndex((route) => route.id === right.id),
  );
  if (
    routes.length !== MEASUREMENT_ROUTES.length ||
    MEASUREMENT_ROUTES.some((route) => !routes.some((candidate) => candidate.id === route.id))
  ) {
    fail("combined-route-set-incomplete");
  }
  const uniqueAssets = new Set(
    routes.flatMap((route) =>
      route.assets.map((asset) => `${route.mode}:${asset.path}:${asset.sha256}`),
    ),
  );
  const withoutChecksum = {
    schemaVersion: PHASE5A0D_SCHEMA_VERSION,
    kind: "phase5a0d-route-js" as const,
    sourceCommit: publicReport.sourceCommit,
    environmentClass: publicReport.environmentClass,
    platform: publicReport.platform,
    nodeVersion: publicReport.nodeVersion,
    zlibVersion: publicReport.zlibVersion,
    nextVersion: publicReport.nextVersion,
    chromiumVersion: publicReport.chromiumVersion,
    compression: "gzip-level-9" as const,
    sourceOfTruth: "cold-browser-next-static-script-responses" as const,
    sharedDefinition:
      "asset-observed-on-more-than-one-selected-route-in-the-same-runtime-mode" as const,
    routeCount: routes.length,
    uniqueChunkCount: uniqueAssets.size,
    runtimeModes: Object.freeze(
      [publicReport, authReport].map((report) =>
        Object.freeze({
          mode: report.mode,
          buildId: report.buildId,
          buildFingerprint: report.buildFingerprint,
          browserProfile: report.browserProfile,
          fixtureState: report.fixtureState,
          containmentMarkers: report.containmentMarkers,
        }),
      ),
    ),
    routes: Object.freeze(routes),
  };
  return Object.freeze({ ...withoutChecksum, reportChecksum: checksum(withoutChecksum) });
}

export function validateRouteJsReport(value: unknown): asserts value is RouteJsReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("baseline-shape-invalid");
  const report = value as Partial<RouteJsReport>;
  if (
    report.schemaVersion !== PHASE5A0D_SCHEMA_VERSION ||
    report.kind !== "phase5a0d-route-js" ||
    report.compression !== "gzip-level-9" ||
    report.sourceOfTruth !== "cold-browser-next-static-script-responses" ||
    report.sharedDefinition !==
      "asset-observed-on-more-than-one-selected-route-in-the-same-runtime-mode" ||
    !Array.isArray(report.routes) ||
    report.routes.length !== MEASUREMENT_ROUTES.length ||
    report.routeCount !== MEASUREMENT_ROUTES.length ||
    !Array.isArray(report.runtimeModes) ||
    report.runtimeModes.length !== 2 ||
    !Number.isSafeInteger(report.uniqueChunkCount) ||
    (report.uniqueChunkCount ?? 0) <= 0 ||
    typeof report.reportChecksum !== "string"
  ) {
    fail("baseline-schema-invalid");
  }
  validateEnvironmentFields(report);
  const reportRoutes = report.routes as readonly RouteJsMeasurement[];
  for (const mode of ["public", "local-authenticated"] as const) {
    validateRouteMeasurements(
      reportRoutes.filter((route) => route.mode === mode),
      mode,
    );
    const runtime = report.runtimeModes.find((candidate) => candidate.mode === mode);
    if (
      !runtime ||
      typeof runtime.buildId !== "string" ||
      !/^[A-Za-z0-9_-]+$/u.test(runtime.buildId) ||
      typeof runtime.buildFingerprint !== "string" ||
      !/^[0-9a-f]{64}$/u.test(runtime.buildFingerprint)
    ) {
      fail(`baseline-runtime-mode-invalid:${mode}`);
    }
    validateBrowserProfile(runtime.browserProfile);
    validateFixtureState(runtime.fixtureState, mode);
    validateContainmentMarkers(runtime.containmentMarkers);
    const expectedMarkers = [
      ...new Set(
        reportRoutes
          .filter((route) => route.mode === mode)
          .flatMap((route) => route.containmentMarkers),
      ),
    ].sort();
    if (stableJson(runtime.containmentMarkers) !== stableJson(expectedMarkers)) {
      fail(`baseline-runtime-containment-mismatch:${mode}`);
    }
  }
  const expectedUniqueAssets = new Set(
    reportRoutes.flatMap((route) =>
      route.assets.map((asset) => `${route.mode}:${asset.path}:${asset.sha256}`),
    ),
  ).size;
  if (report.uniqueChunkCount !== expectedUniqueAssets) {
    fail("baseline-unique-chunk-count-invalid");
  }
  const { reportChecksum, ...withoutChecksum } = report as RouteJsReport;
  if (checksum(withoutChecksum) !== reportChecksum) fail("baseline-checksum-mismatch");
}

export function compareRouteJsReports(
  baselineValue: unknown,
  currentValue: unknown,
): {
  readonly failed: boolean;
  readonly routes: readonly {
    readonly id: string;
    readonly baselineGzipBytes: number;
    readonly currentGzipBytes: number;
    readonly regression: ReturnType<typeof calculateRegression>;
    readonly targetMet: boolean | null;
  }[];
} {
  validateRouteJsReport(baselineValue);
  validateRouteJsReport(currentValue);
  for (const field of [
    "environmentClass",
    "platform",
    "nodeVersion",
    "zlibVersion",
    "nextVersion",
    "chromiumVersion",
    "compression",
    "sourceOfTruth",
    "sharedDefinition",
  ] as const) {
    if (baselineValue[field] !== currentValue[field]) {
      fail(`comparison-environment-mismatch:${field}`);
    }
  }
  for (const mode of ["public", "local-authenticated"] as const) {
    const baselineRuntime = baselineValue.runtimeModes.find((runtime) => runtime.mode === mode);
    const currentRuntime = currentValue.runtimeModes.find((runtime) => runtime.mode === mode);
    if (
      !baselineRuntime ||
      !currentRuntime ||
      stableJson(baselineRuntime.browserProfile) !== stableJson(currentRuntime.browserProfile) ||
      stableJson(baselineRuntime.fixtureState) !== stableJson(currentRuntime.fixtureState) ||
      stableJson(baselineRuntime.containmentMarkers) !==
        stableJson(currentRuntime.containmentMarkers)
    ) {
      fail(`comparison-runtime-contract-mismatch:${mode}`);
    }
  }
  const routes = MEASUREMENT_ROUTES.map((expected) => {
    const baseline = baselineValue.routes.find(
      (route) => route.id === expected.id,
    ) as RouteJsMeasurement;
    const current = currentValue.routes.find(
      (route) => route.id === expected.id,
    ) as RouteJsMeasurement;
    return Object.freeze({
      id: expected.id,
      baselineGzipBytes: baseline.gzipBytes,
      currentGzipBytes: current.gzipBytes,
      regression: calculateRegression(baseline.gzipBytes, current.gzipBytes),
      targetMet: current.targetMet,
    });
  });
  return Object.freeze({
    failed: routes.some((route) => route.regression.failed),
    routes: Object.freeze(routes),
  });
}

export function compareRouteJsModeReports(
  baselineValue: unknown,
  currentValue: unknown,
): ReturnType<typeof compareRouteJsReports> {
  validateRouteJsModeReport(baselineValue);
  validateRouteJsModeReport(currentValue);
  if (baselineValue.mode !== currentValue.mode) fail("comparison-mode-mismatch");
  for (const field of [
    "environmentClass",
    "platform",
    "nodeVersion",
    "zlibVersion",
    "nextVersion",
    "chromiumVersion",
    "compression",
    "sourceOfTruth",
  ] as const) {
    if (baselineValue[field] !== currentValue[field]) {
      fail(`comparison-environment-mismatch:${field}`);
    }
  }
  if (
    stableJson(baselineValue.browserProfile) !== stableJson(currentValue.browserProfile) ||
    stableJson(baselineValue.fixtureState) !== stableJson(currentValue.fixtureState) ||
    stableJson(baselineValue.containmentMarkers) !== stableJson(currentValue.containmentMarkers)
  ) {
    fail("comparison-runtime-contract-mismatch");
  }
  const expectedRoutes = MEASUREMENT_ROUTES.filter(
    (route) => routeMode(route) === baselineValue.mode,
  );
  const routes = expectedRoutes.map((expected) => {
    const baseline = baselineValue.routes.find(
      (route) => route.id === expected.id,
    ) as RouteJsMeasurement;
    const current = currentValue.routes.find(
      (route) => route.id === expected.id,
    ) as RouteJsMeasurement;
    return Object.freeze({
      id: expected.id,
      baselineGzipBytes: baseline.gzipBytes,
      currentGzipBytes: current.gzipBytes,
      regression: calculateRegression(baseline.gzipBytes, current.gzipBytes),
      targetMet: current.targetMet,
    });
  });
  return Object.freeze({
    failed: routes.some((route) => route.regression.failed),
    routes: Object.freeze(routes),
  });
}

export function formatKiB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

export function formatRouteJsComparisonMarkdown(
  comparison: ReturnType<typeof compareRouteJsReports>,
): string {
  const lines = [
    "## Route-specific JavaScript",
    "",
    "| Route | Main gzip | Head gzip | Delta | Target | Status |",
    "|---|---:|---:|---:|---:|---|",
  ];
  for (const route of comparison.routes) {
    const expected = routeForId(route.id);
    const sign = route.regression.deltaBytes >= 0 ? "+" : "";
    const target = expected.initialJsTargetGzipBytes
      ? formatKiB(expected.initialJsTargetGzipBytes)
      : "not yet set";
    lines.push(
      `| ${expected.label} | ${formatKiB(route.baselineGzipBytes)} | ${formatKiB(route.currentGzipBytes)} | ${sign}${formatKiB(route.regression.deltaBytes)} (${sign}${route.regression.deltaPercent.toFixed(1)}%) | ${target} | ${route.regression.failed ? "FAIL regression" : route.targetMet === false ? "PASS regression; target debt" : "PASS"} |`,
    );
  }
  lines.push(
    "",
    "Regression enforcement fails when either +10 KiB or +5% is exceeded. Existing target debt remains visible and is not redefined as a passing target.",
  );
  return `${lines.join("\n")}\n`;
}
