import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

// Node executes this tooling file directly, so the TypeScript path alias is unavailable.
// eslint-disable-next-line no-restricted-imports
import { PHASE5A2_FIXTURE_SHA256 } from "../../../src/app/dev/phase5a2/_shared/fixture.ts";
import {
  DIRECTION_SELECTION_CANDIDATE_RELATIVE_PATHS,
  DIRECTION_SELECTION_MAX_VIDEO_DURATION_MS,
  DIRECTION_SELECTION_MAX_PACKAGE_BYTES,
  DIRECTION_SELECTION_MAX_PNG_BYTES,
  DIRECTION_SELECTION_MAX_VIDEO_BYTES,
  DIRECTION_SELECTION_MIN_VIDEO_DURATION_MS,
  DIRECTION_SELECTION_STILLS,
  DIRECTION_SELECTION_VIDEOS,
  getDirectionSelectionCandidateRoot,
  stillRelativePath,
  videoRelativePath,
} from "./capture-contract.ts";
import {
  assertOwnedDirectory,
  assertOwnedRegularFile,
  assertSafeDirectoryRoot,
} from "./evidence-safety.ts";
import {
  verifyPlaywrightWebm,
  type VerifiedPlaywrightWebm,
} from "./webm-evidence.ts";

export interface DirectionSelectionRuntime {
  readonly schemaVersion: 1;
  readonly kind: "phase5a2-direction-selection-runtime";
  readonly sourceSha: string;
  readonly sourceTreeSha: string;
  readonly fixtureSha256: string;
  readonly playwrightVersion: string;
  readonly browserName: "chromium";
  readonly browserVersion: string;
  readonly timezoneId: "UTC";
  readonly browserLocale: "en-US";
  readonly nodeVersion: string;
  readonly osPlatform: NodeJS.Platform;
  readonly osArch: string;
}

export interface VerifiedCandidateFile {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly video?: VerifiedPlaywrightWebm;
}

export interface VerifiedDirectionSelectionCandidates {
  readonly root: string;
  readonly runtime: DirectionSelectionRuntime;
  readonly files: readonly VerifiedCandidateFile[];
}

function fail(code: string): never {
  throw new Error(`[P5A2_EVIDENCE] ${code}`);
}

function listFiles(root: string, directory = root): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) fail("candidate-entry-symlink");
    if (entry.isDirectory()) files.push(...listFiles(root, filename));
    else if (entry.isFile()) files.push(path.relative(root, filename).split(path.sep).join("/"));
    else fail("candidate-entry-invalid");
  }
  return files;
}

function sha256(filename: string): string {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

function git(repositoryRoot: string, args: readonly string[]): string {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) fail("source-provenance-unavailable");
  return result.stdout.trim();
}

function expectedSourceProvenance(frontendRoot: string): {
  readonly sourceSha: string;
  readonly sourceTreeSha: string;
} {
  const repositoryRoot = path.resolve(frontendRoot, "..");
  if (git(repositoryRoot, ["status", "--porcelain=v1", "--untracked-files=all"])) {
    fail("source-worktree-not-clean");
  }
  const sourceSha = git(repositoryRoot, ["rev-parse", "HEAD"]);
  const sourceTreeSha = git(repositoryRoot, ["rev-parse", "HEAD^{tree}"]);
  if (!/^[0-9a-f]{40}$/u.test(sourceSha) || !/^[0-9a-f]{40}$/u.test(sourceTreeSha)) {
    fail("source-provenance-invalid");
  }
  const environmentSourceSha = process.env.PHASE5A2_DIRECTION_SOURCE_SHA;
  const environmentSourceTreeSha = process.env.PHASE5A2_DIRECTION_SOURCE_TREE_SHA;
  if (
    (environmentSourceSha !== undefined && environmentSourceSha !== sourceSha) ||
    (environmentSourceTreeSha !== undefined && environmentSourceTreeSha !== sourceTreeSha)
  ) {
    fail("source-provenance-mismatch");
  }
  return { sourceSha, sourceTreeSha };
}

function parseRuntime(
  filename: string,
  expected: Readonly<{ sourceSha: string; sourceTreeSha: string }>,
): DirectionSelectionRuntime {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filename, "utf8"));
  } catch {
    fail("runtime-format-invalid");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("runtime-format-invalid");
  }
  const runtime = parsed as Record<string, unknown>;
  const expectedKeys = [
    "browserLocale",
    "browserName",
    "browserVersion",
    "fixtureSha256",
    "kind",
    "nodeVersion",
    "osArch",
    "osPlatform",
    "playwrightVersion",
    "schemaVersion",
    "sourceSha",
    "sourceTreeSha",
    "timezoneId",
  ];
  if (JSON.stringify(Object.keys(runtime).sort()) !== JSON.stringify(expectedKeys)) {
    fail("runtime-fields-invalid");
  }
  if (
    runtime.schemaVersion !== 1 ||
    runtime.kind !== "phase5a2-direction-selection-runtime" ||
    runtime.sourceSha !== expected.sourceSha ||
    runtime.sourceTreeSha !== expected.sourceTreeSha ||
    runtime.fixtureSha256 !== PHASE5A2_FIXTURE_SHA256 ||
    runtime.browserName !== "chromium" ||
    runtime.timezoneId !== "UTC" ||
    runtime.browserLocale !== "en-US" ||
    typeof runtime.nodeVersion !== "string" ||
    !/^v\d+\.\d+\.\d+(?:[-+].+)?$/u.test(runtime.nodeVersion) ||
    typeof runtime.osPlatform !== "string" ||
    !/^(?:aix|android|darwin|freebsd|haiku|linux|openbsd|sunos|win32)$/u.test(
      runtime.osPlatform,
    ) ||
    typeof runtime.osArch !== "string" ||
    !/^[a-z0-9_]+$/u.test(runtime.osArch) ||
    typeof runtime.playwrightVersion !== "string" ||
    !/^\d+\.\d+\.\d+$/u.test(runtime.playwrightVersion) ||
    typeof runtime.browserVersion !== "string" ||
    !/^\d+(?:\.\d+){1,3}$/u.test(runtime.browserVersion)
  ) {
    fail("runtime-contract-invalid");
  }
  return runtime as unknown as DirectionSelectionRuntime;
}

export async function verifyDirectionSelectionCandidates(): Promise<VerifiedDirectionSelectionCandidates> {
  const frontendRoot = assertSafeDirectoryRoot(process.cwd(), "frontend-root");
  const expectedProvenance = expectedSourceProvenance(frontendRoot);
  const expectedRoot = getDirectionSelectionCandidateRoot(frontendRoot);
  if (
    path.dirname(expectedRoot) !== path.join(frontendRoot, "test-results") ||
    path.basename(expectedRoot) !== "phase5a2-direction-selection-candidates"
  ) {
    fail("candidate-root-invalid");
  }
  const root = assertOwnedDirectory(
    frontendRoot,
    ["test-results", "phase5a2-direction-selection-candidates"],
    "candidate-root",
  );
  const expected = [...DIRECTION_SELECTION_CANDIDATE_RELATIVE_PATHS, "runtime.json"].sort();
  const actual = listFiles(root).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("candidate-root-contents-invalid");
  }

  for (const capture of DIRECTION_SELECTION_STILLS) {
    const relativePath = stillRelativePath(capture);
    const filename = assertOwnedRegularFile(root, relativePath, "candidate-png");
    const signature = readFileSync(filename).subarray(0, 8).toString("hex");
    if (signature !== "89504e470d0a1a0a") fail("candidate-png-signature-invalid");
    const metadata = await sharp(filename).metadata();
    if (metadata.width !== capture.width || metadata.height !== capture.height) {
      fail("candidate-png-dimensions-invalid");
    }
    const bytes = statSync(filename).size;
    if (bytes <= 0 || bytes > DIRECTION_SELECTION_MAX_PNG_BYTES) {
      fail("candidate-png-size-invalid");
    }
  }

  const videoMetadata = new Map<string, VerifiedPlaywrightWebm>();
  for (const capture of DIRECTION_SELECTION_VIDEOS) {
    const relativePath = videoRelativePath(capture);
    const filename = assertOwnedRegularFile(root, relativePath, "candidate-video");
    const bytes = statSync(filename).size;
    if (bytes <= 0 || bytes > DIRECTION_SELECTION_MAX_VIDEO_BYTES) {
      fail("candidate-video-size-invalid");
    }
    videoMetadata.set(
      relativePath,
      verifyPlaywrightWebm(readFileSync(filename), {
        expectedWidth: capture.width,
        expectedHeight: capture.height,
        minimumDurationMs: DIRECTION_SELECTION_MIN_VIDEO_DURATION_MS,
        maximumDurationMs: DIRECTION_SELECTION_MAX_VIDEO_DURATION_MS,
      }),
    );
  }

  const files = DIRECTION_SELECTION_CANDIDATE_RELATIVE_PATHS.map((relativePath) => {
    const filename = assertOwnedRegularFile(root, relativePath, "candidate-file");
    return {
      path: relativePath,
      bytes: statSync(filename).size,
      sha256: sha256(filename),
      ...(videoMetadata.has(relativePath)
        ? { video: videoMetadata.get(relativePath) as VerifiedPlaywrightWebm }
        : {}),
    };
  });
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (totalBytes > DIRECTION_SELECTION_MAX_PACKAGE_BYTES) {
    fail("candidate-package-size-invalid");
  }
  return {
    root,
    runtime: parseRuntime(
      assertOwnedRegularFile(root, "runtime.json", "candidate-runtime"),
      expectedProvenance,
    ),
    files,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyDirectionSelectionCandidates();
  process.stdout.write("Phase 5A.2 direction-selection candidates verified.\n");
}
