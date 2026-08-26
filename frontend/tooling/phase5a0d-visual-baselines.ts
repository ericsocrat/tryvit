import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

// Node's type-stripping loader requires the source extension at runtime.
// prettier-ignore
// @ts-expect-error TS5097: executed with `node --experimental-strip-types`.
import { PHASE5A0D_FIXED_TIME, PHASE5A0D_SCHEMA_VERSION, VISUAL_BASELINE_CASES, VISUAL_FIXTURE_CONTRACT, VISUAL_MAX_DIFF_PIXEL_RATIO, assertVisualBaselineContract } from "./phase5a0d-contract.ts";

export const VISUAL_MANIFEST_FILENAME = "phase5a0d-manifest.json" as const;

interface VisualManifestCase {
  readonly id: string;
  readonly mode: "public" | "local-authenticated";
  readonly routeId: "landing" | "login" | "app-shell";
  readonly path: string;
  readonly width: 390 | 768 | 1440;
  readonly height: 844 | 1024 | 900;
  readonly fixtureState: "public-static" | "local-authenticated-new-user";
  readonly relativeFile: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface VisualBaselineManifest {
  readonly schemaVersion: number;
  readonly kind: "phase5a0d-visual-baselines";
  readonly sourceCommit: string;
  readonly rendererClass: "ci-linux-authoritative";
  readonly runner: {
    readonly imageOS: string;
    readonly imageVersion: string;
    readonly arch: string;
  };
  readonly versions: {
    readonly node: string;
    readonly npm: string;
    readonly next: string;
    readonly playwright: string;
    readonly chromium: string;
  };
  readonly settings: {
    readonly locale: "en-US";
    readonly timezoneId: "UTC";
    readonly deviceScaleFactor: 1;
    readonly colorScheme: "light";
    readonly reducedMotion: "reduce";
    readonly fixedTime: typeof PHASE5A0D_FIXED_TIME;
    readonly fullPage: false;
    readonly masks: readonly [];
    readonly maxDiffPixelRatio: typeof VISUAL_MAX_DIFF_PIXEL_RATIO;
    readonly channelThreshold: 0.2;
  };
  readonly fixtureContractChecksum: string;
  readonly cases: readonly VisualManifestCase[];
  readonly manifestChecksum: string;
}

function fail(code: string): never {
  throw new Error(`[P5_VISUAL] ${code}`);
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

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function visualFixtureContractChecksum(): string {
  return sha256(stableJson(VISUAL_FIXTURE_CONTRACT));
}

function readPackageVersion(frontendRoot: string, packageName: string): string {
  const parsed = JSON.parse(
    readFileSync(path.join(frontendRoot, "node_modules", packageName, "package.json"), "utf8"),
  ) as { version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    fail(`package-version-unavailable:${packageName}`);
  }
  return parsed.version;
}

function npmVersion(): string {
  const userAgent = process.env.npm_config_user_agent ?? "";
  const match = /(?:^|\s)npm\/([^\s]+)/u.exec(userAgent);
  if (!match) fail("npm-version-unavailable");
  return match[1];
}

export function visualBaselineRoot(frontendRoot = process.cwd()): string {
  return path.resolve(frontendRoot, "e2e", "__screenshots__");
}

export function visualRelativeFile(baseline: (typeof VISUAL_BASELINE_CASES)[number]): string {
  const specDirectory =
    baseline.mode === "public" ? "smoke-visual.spec.ts" : "authenticated-visual.spec.ts";
  return `${specDirectory}/${baseline.filename}`;
}

export function visualArtifactRelativeFiles(): readonly string[] {
  return Object.freeze(
    [VISUAL_MANIFEST_FILENAME, ...VISUAL_BASELINE_CASES.map(visualRelativeFile)].sort(),
  );
}

function assertNoReparseSegments(candidate: string, code: string): void {
  const lexical = path.resolve(candidate);
  const parsed = path.parse(lexical);
  let cursor = parsed.root;
  for (const segment of path.relative(parsed.root, lexical).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) fail(`${code}-reparse`);
  }
}

function assertRealDirectory(candidate: string, code: string): string {
  const lexical = path.resolve(candidate);
  if (!existsSync(lexical)) fail(`${code}-missing`);
  assertNoReparseSegments(lexical, code);
  const metadata = lstatSync(lexical);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail(`${code}-reparse`);
  return realpathSync.native(lexical);
}

function assertWritableRegularTarget(target: string, code: string): void {
  if (!existsSync(target)) return;
  assertNoReparseSegments(target, code);
  const metadata = lstatSync(target);
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail(`${code}-reparse`);
}

/**
 * Establishes the only directories Playwright may update during authoritative
 * candidate generation. Every existing path is checked before Playwright can
 * write a byte; no symlink or reparse-point traversal is accepted.
 */
export function prepareVisualBaselineWriteTargets(frontendRoot = process.cwd()): string {
  const resolvedFrontendRoot = assertRealDirectory(frontendRoot, "frontend-root");
  const e2eRoot = assertRealDirectory(path.join(resolvedFrontendRoot, "e2e"), "e2e-root");
  const root = path.join(e2eRoot, "__screenshots__");
  if (!existsSync(root)) mkdirSync(root);
  assertRealDirectory(root, "baseline-root");

  const relativeFiles = [
    VISUAL_MANIFEST_FILENAME,
    ...VISUAL_BASELINE_CASES.map(visualRelativeFile),
  ];
  for (const relativeFile of relativeFiles) {
    const target = path.resolve(root, ...relativeFile.split("/"));
    const relative = path.relative(root, target);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      fail("baseline-path-outside-root");
    }
    const parent = path.dirname(target);
    if (!existsSync(parent)) mkdirSync(parent);
    assertRealDirectory(parent, "baseline-target-parent");
    assertWritableRegularTarget(target, "baseline-target");
  }
  return root;
}

function assertOwnedBaselinePath(root: string, relativeFile: string): string {
  assertRealDirectory(root, "baseline-root");
  const target = path.resolve(root, ...relativeFile.split("/"));
  const relative = path.relative(root, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail("baseline-path-outside-root");
  }
  assertRealDirectory(path.dirname(target), "baseline-target-parent");
  if (!existsSync(target) || !lstatSync(target).isFile() || lstatSync(target).isSymbolicLink()) {
    fail(`baseline-file-unavailable:${relativeFile}`);
  }
  const resolved = realpathSync.native(target);
  return resolved;
}

export function listPhase5BaselinePngs(root: string): string[] {
  if (!existsSync(root)) return [];
  const result: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) fail("baseline-path-reparse");
      if (entry.isDirectory()) {
        visit(candidate);
      } else if (entry.isFile()) {
        if (entry.name.startsWith("p5a0d-") && entry.name.endsWith(".png")) {
          result.push(path.relative(root, candidate).replaceAll(path.sep, "/"));
        }
      } else {
        fail("baseline-entry-invalid");
      }
    }
  };
  visit(root);
  return result.sort();
}

function assertAuthoritativeEnvironment(): void {
  if (
    process.env.CI !== "true" ||
    process.platform !== "linux" ||
    !process.env.ImageOS ||
    !process.env.ImageVersion
  ) {
    fail("authoritative-linux-ci-required");
  }
}

export async function currentRendererIdentity(frontendRoot = process.cwd()) {
  assertAuthoritativeEnvironment();
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  let chromiumVersion: string;
  try {
    chromiumVersion = browser.version();
  } finally {
    await browser.close();
  }
  return Object.freeze({
    runner: Object.freeze({
      imageOS: process.env.ImageOS as string,
      imageVersion: process.env.ImageVersion as string,
      arch: process.arch,
    }),
    versions: Object.freeze({
      node: process.version,
      npm: npmVersion(),
      next: readPackageVersion(frontendRoot, "next"),
      playwright: readPackageVersion(frontendRoot, "@playwright/test"),
      chromium: chromiumVersion,
    }),
  });
}

export function rendererIdentityMismatchFields(
  expected: Pick<VisualBaselineManifest, "runner" | "versions">,
  actual: Pick<VisualBaselineManifest, "runner" | "versions">,
): string[] {
  const mismatches: string[] = [];
  for (const field of ["imageOS", "imageVersion", "arch"] as const) {
    if (expected.runner[field] !== actual.runner[field]) mismatches.push(`runner.${field}`);
  }
  for (const field of ["node", "npm", "next", "playwright", "chromium"] as const) {
    if (expected.versions[field] !== actual.versions[field]) mismatches.push(`versions.${field}`);
  }
  return mismatches;
}

export interface RendererIdentityComparison {
  readonly blockingMismatches: readonly string[];
  readonly hostedImageVersionObservation: {
    readonly manifest: string;
    readonly actual: string;
  };
}

export function compareRendererIdentity(
  expected: Pick<VisualBaselineManifest, "runner" | "versions">,
  actual: Pick<VisualBaselineManifest, "runner" | "versions">,
): RendererIdentityComparison {
  return Object.freeze({
    blockingMismatches: Object.freeze(
      rendererIdentityMismatchFields(expected, actual).filter(
        (field) => field !== "runner.imageVersion",
      ),
    ),
    hostedImageVersionObservation: Object.freeze({
      manifest: expected.runner.imageVersion,
      actual: actual.runner.imageVersion,
    }),
  });
}

function recordHostedImageVersionObservation(
  observation: RendererIdentityComparison["hostedImageVersionObservation"],
): void {
  const detail = `manifest=${JSON.stringify(observation.manifest)},actual=${JSON.stringify(observation.actual)}`;
  console.log(`[P5_VISUAL] hosted-runner-image-version-observation:${detail}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\n### Phase 5A.0d hosted runner observation\n\n- Manifest image version: \`${observation.manifest}\`\n- Actual image version: \`${observation.actual}\`\n- Disposition: observational; deterministic renderer settings and exact pixels remain blocking.\n`,
      "utf8",
    );
  }
}

export async function generateVisualBaselineManifest(
  frontendRoot = process.cwd(),
): Promise<VisualBaselineManifest> {
  assertVisualBaselineContract();
  const root = prepareVisualBaselineWriteTargets(frontendRoot);
  const expectedFiles = VISUAL_BASELINE_CASES.map(visualRelativeFile).sort();
  if (JSON.stringify(listPhase5BaselinePngs(root)) !== JSON.stringify(expectedFiles)) {
    fail("baseline-file-set-invalid");
  }
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: frontendRoot,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) fail("source-commit-invalid");
  const renderer = await currentRendererIdentity(frontendRoot);
  const cases = VISUAL_BASELINE_CASES.map((baseline): VisualManifestCase => {
    const relativeFile = visualRelativeFile(baseline);
    const bytes = readFileSync(assertOwnedBaselinePath(root, relativeFile));
    return Object.freeze({
      id: baseline.id,
      mode: baseline.mode,
      routeId: baseline.routeId,
      path: baseline.path,
      width: baseline.width,
      height: baseline.height,
      fixtureState: baseline.fixtureState,
      relativeFile,
      sha256: sha256(bytes),
      bytes: bytes.byteLength,
    });
  });
  const withoutChecksum = {
    schemaVersion: PHASE5A0D_SCHEMA_VERSION,
    kind: "phase5a0d-visual-baselines" as const,
    sourceCommit,
    rendererClass: "ci-linux-authoritative" as const,
    runner: renderer.runner,
    versions: renderer.versions,
    settings: Object.freeze({
      locale: "en-US" as const,
      timezoneId: "UTC" as const,
      deviceScaleFactor: 1 as const,
      colorScheme: "light" as const,
      reducedMotion: "reduce" as const,
      fixedTime: PHASE5A0D_FIXED_TIME,
      fullPage: false as const,
      masks: Object.freeze([]) as readonly [],
      maxDiffPixelRatio: VISUAL_MAX_DIFF_PIXEL_RATIO,
      channelThreshold: 0.2 as const,
    }),
    fixtureContractChecksum: visualFixtureContractChecksum(),
    cases: Object.freeze(cases),
  };
  const manifest = Object.freeze({
    ...withoutChecksum,
    manifestChecksum: sha256(stableJson(withoutChecksum)),
  });
  writeFileSync(
    path.join(root, VISUAL_MANIFEST_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return manifest;
}

export function validateVisualBaselineManifest(
  value: unknown,
): asserts value is VisualBaselineManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("manifest-shape-invalid");
  const manifest = value as Partial<VisualBaselineManifest>;
  if (
    manifest.schemaVersion !== PHASE5A0D_SCHEMA_VERSION ||
    manifest.kind !== "phase5a0d-visual-baselines" ||
    typeof manifest.sourceCommit !== "string" ||
    !/^[0-9a-f]{40}$/u.test(manifest.sourceCommit) ||
    manifest.rendererClass !== "ci-linux-authoritative" ||
    !manifest.runner ||
    !manifest.versions ||
    !manifest.settings ||
    !Array.isArray(manifest.cases) ||
    manifest.cases.length !== VISUAL_BASELINE_CASES.length ||
    manifest.fixtureContractChecksum !== visualFixtureContractChecksum() ||
    typeof manifest.manifestChecksum !== "string"
  ) {
    fail("manifest-schema-invalid");
  }
  if (
    typeof manifest.runner.imageOS !== "string" ||
    manifest.runner.imageOS.length === 0 ||
    typeof manifest.runner.imageVersion !== "string" ||
    manifest.runner.imageVersion.length === 0 ||
    typeof manifest.runner.arch !== "string" ||
    manifest.runner.arch.length === 0 ||
    Object.values(manifest.versions).some(
      (version) => typeof version !== "string" || version.length === 0,
    )
  ) {
    fail("manifest-renderer-invalid");
  }
  if (
    manifest.settings.locale !== "en-US" ||
    manifest.settings.timezoneId !== "UTC" ||
    manifest.settings.deviceScaleFactor !== 1 ||
    manifest.settings.colorScheme !== "light" ||
    manifest.settings.reducedMotion !== "reduce" ||
    manifest.settings.fixedTime !== PHASE5A0D_FIXED_TIME ||
    manifest.settings.fullPage !== false ||
    !Array.isArray(manifest.settings.masks) ||
    manifest.settings.masks.length !== 0 ||
    manifest.settings.maxDiffPixelRatio !== VISUAL_MAX_DIFF_PIXEL_RATIO ||
    manifest.settings.channelThreshold !== 0.2
  ) {
    fail("manifest-settings-invalid");
  }
  for (let index = 0; index < VISUAL_BASELINE_CASES.length; index += 1) {
    const expected = VISUAL_BASELINE_CASES[index];
    const actual = manifest.cases[index];
    if (
      !actual ||
      actual.id !== expected.id ||
      actual.mode !== expected.mode ||
      actual.routeId !== expected.routeId ||
      actual.path !== expected.path ||
      actual.width !== expected.width ||
      actual.height !== expected.height ||
      actual.fixtureState !== expected.fixtureState ||
      actual.relativeFile !== visualRelativeFile(expected) ||
      typeof actual.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(actual.sha256) ||
      !Number.isSafeInteger(actual.bytes) ||
      actual.bytes <= 0
    ) {
      fail(`manifest-case-invalid:${expected.id}`);
    }
  }
  const { manifestChecksum, ...withoutChecksum } = manifest as VisualBaselineManifest;
  if (sha256(stableJson(withoutChecksum)) !== manifestChecksum) {
    fail("manifest-checksum-mismatch");
  }
}

function readVerifiedVisualBaselineFiles(frontendRoot: string): VisualBaselineManifest {
  assertVisualBaselineContract();
  const root = visualBaselineRoot(frontendRoot);
  const manifestPath = assertOwnedBaselinePath(root, VISUAL_MANIFEST_FILENAME);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  validateVisualBaselineManifest(manifest);
  const expectedFiles = VISUAL_BASELINE_CASES.map(visualRelativeFile).sort();
  if (JSON.stringify(listPhase5BaselinePngs(root)) !== JSON.stringify(expectedFiles)) {
    fail("baseline-file-set-invalid");
  }
  for (const baseline of manifest.cases) {
    const bytes = readFileSync(assertOwnedBaselinePath(root, baseline.relativeFile));
    if (bytes.byteLength !== baseline.bytes || sha256(bytes) !== baseline.sha256) {
      fail(`baseline-hash-mismatch:${baseline.id}`);
    }
  }
  return manifest;
}

function listOwnedArtifactFiles(root: string): string[] {
  const resolvedRoot = assertRealDirectory(root, "artifact-root");
  const files: string[] = [];
  const walk = (directory: string): void => {
    assertRealDirectory(directory, "artifact-directory");
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) fail("artifact-path-reparse");
      if (entry.isDirectory()) {
        walk(candidate);
      } else if (entry.isFile()) {
        assertNoReparseSegments(candidate, "artifact-path");
        files.push(path.relative(resolvedRoot, candidate).replaceAll(path.sep, "/"));
      } else {
        fail("artifact-entry-invalid");
      }
    }
  };
  walk(resolvedRoot);
  return files.sort();
}

/**
 * Copies exactly the seven manifest-listed PNGs and their manifest into a new
 * direct child of RUNNER_TEMP. The destination must not already exist, so this
 * operation never recursively deletes or overwrites an unproven path.
 */
export function stageVisualBaselineArtifact(
  destinationRoot: string,
  frontendRoot = process.cwd(),
  stagingParent = process.env.RUNNER_TEMP,
): string {
  assertAuthoritativeEnvironment();
  if (!stagingParent) fail("artifact-staging-parent-required");
  const resolvedParent = assertRealDirectory(stagingParent, "artifact-staging-parent");
  const requestedDestination = path.resolve(destinationRoot);
  const requestedParent = assertRealDirectory(
    path.dirname(requestedDestination),
    "artifact-destination-parent",
  );
  const destinationName = path.basename(requestedDestination);
  const destination = path.join(resolvedParent, destinationName);
  if (
    requestedParent !== resolvedParent ||
    !/^phase5a0d-(?:first|second)-candidates$/u.test(destinationName) ||
    existsSync(destination)
  ) {
    fail("artifact-destination-not-owned");
  }

  const manifest = readVerifiedVisualBaselineFiles(frontendRoot);
  const sourceRoot = visualBaselineRoot(frontendRoot);
  mkdirSync(destination);
  assertRealDirectory(destination, "artifact-root");
  for (const relativeFile of visualArtifactRelativeFiles()) {
    const source = assertOwnedBaselinePath(sourceRoot, relativeFile);
    const target = path.resolve(destination, ...relativeFile.split("/"));
    const relative = path.relative(destination, target);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      fail("artifact-path-outside-root");
    }
    const parent = path.dirname(target);
    if (!existsSync(parent)) mkdirSync(parent);
    assertRealDirectory(parent, "artifact-target-parent");
    copyFileSync(source, target);
    assertWritableRegularTarget(target, "artifact-target");
  }

  const expectedFiles = [...visualArtifactRelativeFiles()].sort();
  if (JSON.stringify(listOwnedArtifactFiles(destination)) !== JSON.stringify(expectedFiles)) {
    fail("artifact-file-set-invalid");
  }
  for (const baseline of manifest.cases) {
    const staged = readFileSync(assertOwnedBaselinePath(destination, baseline.relativeFile));
    if (staged.byteLength !== baseline.bytes || sha256(staged) !== baseline.sha256) {
      fail(`artifact-hash-mismatch:${baseline.id}`);
    }
  }
  const sourceManifest = readFileSync(
    assertOwnedBaselinePath(sourceRoot, VISUAL_MANIFEST_FILENAME),
  );
  const stagedManifest = readFileSync(
    assertOwnedBaselinePath(destination, VISUAL_MANIFEST_FILENAME),
  );
  if (sha256(sourceManifest) !== sha256(stagedManifest)) fail("artifact-manifest-copy-mismatch");
  return destination;
}

export async function verifyVisualBaselineManifest(
  frontendRoot = process.cwd(),
): Promise<VisualBaselineManifest> {
  const manifest = readVerifiedVisualBaselineFiles(frontendRoot);
  const renderer = await currentRendererIdentity(frontendRoot);
  const comparison = compareRendererIdentity(manifest, renderer);
  recordHostedImageVersionObservation(comparison.hostedImageVersionObservation);
  if (comparison.blockingMismatches.length > 0) {
    fail(`baseline-renderer-mismatch:${comparison.blockingMismatches.join(",")}`);
  }
  return manifest;
}
