import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  getCatalogCandidateRelativePaths,
  parseCatalogSourceStatus,
} from "./capture-contract.ts";

interface CandidateManifestEntry {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

interface CandidateManifest {
  readonly schemaVersion: number;
  readonly kind: string;
  readonly sourceSha: string;
  readonly sourceTreeSha: string;
  readonly pullRequestHeadSha: string;
  readonly sourceState: "clean" | "next-build-generated" | "dirty-development-worktree";
  readonly sourceWorktreeSha: string;
  readonly candidateStatus: string;
  readonly sceneCaptureCount: number;
  readonly contactSheetCount: number;
  readonly files: readonly CandidateManifestEntry[];
}

function fail(code: string): never {
  throw new Error(`[PHASE5A1_CATALOG] ${code}`);
}

const candidateRoot = path.resolve(process.cwd(), "test-results", "phase5a1-catalog-candidates");
const manifestPath = path.join(candidateRoot, "manifest.json");
const expectedSourceSha = process.env.PHASE5A1_CATALOG_SOURCE_SHA;
const expectedPullRequestHeadSha = process.env.PHASE5A1_CATALOG_PR_HEAD_SHA ?? expectedSourceSha;
const repositoryRoot = path.resolve(process.cwd(), "..");
const expectedCandidatePaths = new Set(getCatalogCandidateRelativePaths());

function listCandidateEntries(root: string): { readonly directories: string[]; readonly files: string[] } {
  const directories: string[] = [];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      const details = lstatSync(absolute);
      if (details.isSymbolicLink()) fail("candidate-entry-symlink");
      if (details.isDirectory()) {
        directories.push(relative);
        visit(absolute);
      } else if (details.isFile()) {
        files.push(relative);
      } else {
        fail("candidate-entry-type-invalid");
      }
    }
  };
  visit(root);
  const ordinal = (left: string, right: string): number =>
    left === right ? 0 : left < right ? -1 : 1;
  return { directories: directories.sort(ordinal), files: files.sort(ordinal) };
}

function gitRevision(revision: string): string {
  const value = execFileSync("git", ["rev-parse", revision], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  if (!/^[0-9a-f]{40}$/u.test(value)) fail("checkout-source-sha-invalid");
  return value;
}

const checkoutSourceSha = gitRevision("HEAD");
const checkoutTreeSha = gitRevision("HEAD^{tree}");
const checkoutSourceStatus = parseCatalogSourceStatus(execFileSync(
  "git",
  ["status", "--porcelain=v1", "--untracked-files=normal"],
  { cwd: repositoryRoot, encoding: "utf8" },
));
const checkoutWorkingTreeStatus = checkoutSourceStatus.status;
const checkoutSourceState = checkoutSourceStatus.state;
const checkoutWorkingTreeDiff = execFileSync("git", ["diff", "--binary", "--no-ext-diff"], {
  cwd: repositoryRoot,
  encoding: "utf8",
});
const checkoutWorktreeSha = createHash("sha256")
  .update(`${checkoutWorkingTreeStatus}\0${checkoutWorkingTreeDiff}`, "utf8")
  .digest("hex");

if (!/^[0-9a-f]{40}$/u.test(expectedSourceSha ?? "")) fail("expected-source-sha-invalid");
if (!/^[0-9a-f]{40}$/u.test(expectedPullRequestHeadSha ?? "")) {
  fail("expected-pull-request-head-sha-invalid");
}
if (expectedSourceSha !== checkoutSourceSha) fail("checkout-source-sha-mismatch");
if (process.env.CI && checkoutSourceState === "dirty-development-worktree") {
  fail("checkout-worktree-dirty");
}
if (!existsSync(candidateRoot) || lstatSync(candidateRoot).isSymbolicLink()) {
  fail("candidate-root-invalid");
}
if (!lstatSync(candidateRoot).isDirectory()) fail("candidate-root-invalid");
if (!existsSync(manifestPath)) fail("candidate-manifest-missing");

const expectedDirectories = new Set(
  [...expectedCandidatePaths].map((candidatePath) => path.posix.dirname(candidatePath)),
);
const actualEntries = listCandidateEntries(candidateRoot);
if (
  actualEntries.directories.length !== expectedDirectories.size ||
  actualEntries.directories.some((directory) => !expectedDirectories.has(directory)) ||
  actualEntries.files.length !== expectedCandidatePaths.size + 1 ||
  !actualEntries.files.includes("manifest.json") ||
  actualEntries.files.some((filename) =>
    filename !== "manifest.json" && !expectedCandidatePaths.has(filename),
  )
) {
  fail("candidate-root-contents-invalid");
}

let manifest: CandidateManifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CandidateManifest;
} catch {
  fail("candidate-manifest-json-invalid");
}

if (
  manifest.schemaVersion !== 2 ||
  manifest.kind !== "phase5a1-foundation-catalog-candidates" ||
  manifest.sourceSha !== expectedSourceSha ||
  manifest.sourceTreeSha !== checkoutTreeSha ||
  manifest.pullRequestHeadSha !== expectedPullRequestHeadSha ||
  manifest.sourceState !== checkoutSourceState ||
  manifest.sourceWorktreeSha !== checkoutWorktreeSha ||
  !/^[0-9a-f]{64}$/u.test(manifest.sourceWorktreeSha) ||
  manifest.candidateStatus !== "human-review-required-not-a-production-baseline" ||
  manifest.sceneCaptureCount !== 72 ||
  manifest.contactSheetCount !== 18 ||
  manifest.files.length !== 90
) {
  fail("candidate-manifest-contract-invalid");
}

const paths = new Set<string>();
for (const entry of manifest.files) {
  if (
    paths.has(entry.path) ||
    !expectedCandidatePaths.has(entry.path) ||
    !entry.path.endsWith(".png") ||
    path.isAbsolute(entry.path) ||
    entry.path.split("/").includes("..") ||
    !/^[0-9a-f]{64}$/u.test(entry.sha256) ||
    !Number.isSafeInteger(entry.bytes) ||
    entry.bytes <= 0
  ) {
    fail("candidate-manifest-entry-invalid");
  }
  paths.add(entry.path);
  const filename = path.resolve(candidateRoot, ...entry.path.split("/"));
  if (!filename.startsWith(`${candidateRoot}${path.sep}`) || !existsSync(filename)) {
    fail("candidate-file-missing");
  }
  const bytes = readFileSync(filename);
  if (
    statSync(filename).size !== entry.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== entry.sha256
  ) {
    fail("candidate-file-integrity-invalid");
  }
}

if (
  paths.size !== expectedCandidatePaths.size ||
  [...expectedCandidatePaths].some((expectedPath) => !paths.has(expectedPath))
) {
  fail("candidate-manifest-path-matrix-invalid");
}

const manifestChecksum = createHash("sha256")
  .update(readFileSync(manifestPath))
  .digest("hex");
process.stdout.write(
  `[PHASE5A1_CATALOG] manifest-verified scenes=72 contact-sheets=18 sha256=${manifestChecksum}\n`,
);
