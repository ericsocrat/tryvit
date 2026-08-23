import { createHash } from "node:crypto";
import { lstatSync, readdirSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import {
  GOLDEN_COMMITTED_BINARY_LIMIT_BYTES,
  goldenEvidenceRoot,
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

if (
  retainedBytes !== manifest.retainedBytes ||
  retainedBytes > GOLDEN_COMMITTED_BINARY_LIMIT_BYTES ||
  retained.length !== 82 ||
  manifest.fontBytes !== 0
) fail("staged-packet-contract-invalid");

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
