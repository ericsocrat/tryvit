import { createHash } from "node:crypto";
import { lstatSync, readdirSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

// Node executes this tooling directly, so the TypeScript path alias is unavailable.
// eslint-disable-next-line no-restricted-imports
import {
  GOLDEN_FONT_ASSAY,
  GOLDEN_FONT_ASSAY_PACKET_FILES,
} from "../../../src/app/dev/phase5a2/_golden/font-assay.ts";

import {
  GOLDEN_COMMITTED_BINARY_LIMIT_BYTES,
  GOLDEN_MOTION_RECORDINGS,
  goldenEvidenceRoot,
  motionTerminalStillRelativePath,
} from "./capture-contract.ts";
// Node executes this tooling directly, so the TypeScript path alias is unavailable.
// eslint-disable-next-line no-restricted-imports
import {
  assertOwnedDirectory,
  assertSafeDirectoryRoot,
  readOwnedRegularFile,
} from "../direction-selection/evidence-safety.ts";
// eslint-disable-next-line no-restricted-imports
import { verifyPlaywrightWebm } from "../direction-selection/webm-evidence.ts";

interface ManifestFile {
  readonly path: string;
  readonly kind: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly width?: number;
  readonly height?: number;
  readonly reference?: string;
  readonly state?: string;
  readonly locale?: string;
  readonly theme?: string;
  readonly motion?: string;
}

function fail(code: string): never {
  throw new Error(`[P5A2_GOLDEN] ${code}`);
}

function sha256(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function listFiles(root: string, directory = root): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    const metadata = lstatSync(filename);
    if (metadata.isSymbolicLink()) fail("staged-entry-symlink");
    if (metadata.isDirectory()) result.push(...listFiles(root, filename));
    else if (metadata.isFile()) result.push(path.relative(root, filename).split(path.sep).join("/"));
    else fail("staged-entry-invalid");
  }
  return result;
}

const frontendRoot = assertSafeDirectoryRoot(process.cwd(), "frontend-root");
const repositoryRoot = assertSafeDirectoryRoot(path.resolve(frontendRoot, ".."), "repository-root");
const root = assertOwnedDirectory(
  repositoryRoot,
  ["docs", "phase5a2", "checkpoint-2", "evidence"],
  "golden-staged-root",
);
if (root !== goldenEvidenceRoot(repositoryRoot)) fail("staged-root-invalid");
const manifestContents = readOwnedRegularFile(root, "manifest.json", "golden-manifest", 2 * 1024 * 1024).contents;
let parsed: unknown;
try { parsed = JSON.parse(manifestContents.toString("utf8")); } catch { fail("manifest-format-invalid"); }
if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("manifest-format-invalid");
const manifest = parsed as Record<string, unknown>;
if (
  manifest.schemaVersion !== 1 ||
  manifest.kind !== "phase5a2-selected-hybrid-golden-reference-evidence" ||
  manifest.reviewOnly !== true ||
  manifest.productionBaseline !== false ||
  typeof manifest.sourceSha !== "string" ||
  !/^[0-9a-f]{40}$/u.test(manifest.sourceSha) ||
  typeof manifest.sourceTreeSha !== "string" ||
  !/^[0-9a-f]{40}$/u.test(manifest.sourceTreeSha) ||
  !Array.isArray(manifest.files) ||
  !Array.isArray(manifest.rawFiles)
) fail("manifest-contract-invalid");

const retained = manifest.files as ManifestFile[];
const expected = [...retained.map((file) => file.path), "manifest.json"].sort();
if (JSON.stringify(listFiles(root).sort()) !== JSON.stringify(expected)) {
  fail("staged-root-contents-invalid");
}

let retainedBytes = 0;
for (const file of retained) {
  if (
    !file ||
    typeof file.path !== "string" ||
    !file.path ||
    path.posix.isAbsolute(file.path) ||
    file.path.split("/").some((segment) => !segment || segment === "." || segment === "..") ||
    typeof file.bytes !== "number" ||
    file.bytes <= 0 ||
    typeof file.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(file.sha256)
  ) fail("manifest-file-invalid");
  const { contents } = readOwnedRegularFile(root, file.path, "golden-retained-file", 4 * 1024 * 1024);
  if (contents.length !== file.bytes || sha256(contents) !== file.sha256) {
    fail("staged-file-snapshot-invalid");
  }
  retainedBytes += contents.length;
  if (file.path.endsWith(".png")) {
    if (contents.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") fail("staged-png-signature-invalid");
    const metadata = await sharp(contents).metadata();
    if (file.width !== undefined && metadata.width !== file.width) fail("staged-png-width-invalid");
    if (file.height !== undefined && metadata.height !== file.height) fail("staged-png-height-invalid");
  }
  if (file.path.endsWith(".webm")) {
    if (!file.width || !file.height) fail("staged-video-dimensions-missing");
    verifyPlaywrightWebm(contents, {
      expectedWidth: file.width,
      expectedHeight: file.height,
      minimumDurationMs: 2_000,
      maximumDurationMs: 30_000,
    });
  }
}

const journeys = manifest.journeys;
if (!journeys || typeof journeys !== "object" || Array.isArray(journeys)) {
  fail("staged-terminal-provenance-invalid");
}
const actualJourneys = (journeys as Record<string, unknown>).actual;
const rawFiles = manifest.rawFiles as ManifestFile[];
if (!Array.isArray(actualJourneys) || actualJourneys.length !== GOLDEN_MOTION_RECORDINGS.length) {
  fail("staged-terminal-provenance-invalid");
}
for (const [index, capture] of GOLDEN_MOTION_RECORDINGS.entries()) {
  const actual = actualJourneys[index];
  const terminal = rawFiles.find(
    (file) => file.path === motionTerminalStillRelativePath(capture) && file.kind === "terminal",
  );
  if (
    !actual ||
    typeof actual !== "object" ||
    Array.isArray(actual) ||
    !terminal
  ) fail("staged-terminal-provenance-invalid");
  const record = actual as Record<string, unknown>;
  if (
    record.recordingReference !== capture.reference ||
    record.mode !== capture.mode ||
    typeof record.route !== "string" ||
    terminal.reference !== record.reference ||
    terminal.state !== record.liveState ||
    terminal.theme !== record.theme ||
    terminal.motion !== capture.motion
  ) fail("staged-terminal-provenance-invalid");
  const locale = new URL(record.route as string, "http://golden.invalid").searchParams.get("locale");
  if (terminal.locale !== locale) fail("staged-terminal-provenance-invalid");
}

if (
  retainedBytes !== manifest.retainedBytes ||
  retainedBytes > GOLDEN_COMMITTED_BINARY_LIMIT_BYTES ||
  retained.length !== 90 ||
  manifest.fontBytes !== GOLDEN_FONT_ASSAY.transferBytes ||
  manifest.typographyDisposition !== GOLDEN_FONT_ASSAY.status ||
  !manifest.fontAssay ||
  typeof manifest.fontAssay !== "object" ||
  Array.isArray(manifest.fontAssay) ||
  (manifest.fontAssay as Record<string, unknown>).transferredBytes !== GOLDEN_FONT_ASSAY.transferBytes ||
  !manifest.resilience ||
  typeof manifest.resilience !== "object" ||
  Array.isArray(manifest.resilience)
) fail("staged-packet-contract-invalid");

for (const asset of GOLDEN_FONT_ASSAY_PACKET_FILES) {
  const retainedAsset = retained.find((file) => file.path === asset.path);
  if (
    !retainedAsset ||
    retainedAsset.kind !== asset.kind ||
    retainedAsset.bytes !== asset.bytes ||
    retainedAsset.sha256 !== asset.sha256
  ) fail("staged-font-assay-asset-invalid");
}
const fontAssay = manifest.fontAssay as Record<string, unknown>;
const subsetting = fontAssay.subsetting;
if (
  !Array.isArray(fontAssay.computedTypeScale) ||
  fontAssay.computedTypeScale.length !== 8 ||
  !subsetting ||
  typeof subsetting !== "object" ||
  Array.isArray(subsetting) ||
  (subsetting as Record<string, unknown>).deterministicRerunRequired !== false ||
  (subsetting as Record<string, unknown>).deterministicRerunVerified !== true
) fail("staged-font-assay-proof-invalid");
const resilience = manifest.resilience as Record<string, unknown>;
if (
  !Array.isArray(resilience.textSpacing) ||
  resilience.textSpacing.length !== 6 ||
  !Array.isArray(resilience.reflow) ||
  resilience.reflow.length !== 6 ||
  !Array.isArray(resilience.typography) ||
  resilience.typography.length !== 4 ||
  !Array.isArray(resilience.identitySemantics) ||
  resilience.identitySemantics.length !== 2
) fail("staged-resilience-proof-invalid");

const sensitivePatterns = [
  /[A-Za-z]:\\/u,
  /\/home\/[A-Za-z0-9._-]+\//u,
  /\.supabase\.co/iu,
  /vercel\.app/iu,
  /service[_-]?role/iu,
  /eyJ[A-Za-z0-9_-]{20,}/u,
];
const manifestText = manifestContents.toString("utf8");
if (sensitivePatterns.some((pattern) => pattern.test(manifestText))) {
  fail("manifest-sensitive-content");
}

process.stdout.write(`${JSON.stringify({
  sourceSha: manifest.sourceSha,
  sourceTreeSha: manifest.sourceTreeSha,
  manifestSha256: sha256(manifestContents),
  retainedFiles: retained.length + 1,
  retainedBytes: retainedBytes + manifestContents.length,
}, null, 2)}\n`);
