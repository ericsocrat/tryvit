import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  CATALOG_CANDIDATE_FILE_COUNT,
  CATALOG_CONTACT_SHEET_COUNT,
  CATALOG_EVIDENCE_RECORD_COUNT,
  CATALOG_INTERACTION_CAPTURE_COUNT,
  CATALOG_MANIFEST_ENTRY_COUNT,
  CATALOG_PNG_COUNT,
  CATALOG_RESILIENCE_CAPTURE_COUNT,
  CATALOG_SCENE_CAPTURE_COUNT,
  getCatalogCandidatePngRelativePaths,
  getCatalogCandidateRelativePaths,
  getCatalogExpectedEvidenceRecords,
  parseCatalogSourceStatus,
  type CatalogEvidence,
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
  readonly interactionCaptureCount: number;
  readonly resilienceCaptureCount: number;
  readonly contactSheetCount: number;
  readonly evidenceRecordCount: number;
  readonly pngCount: number;
  readonly files: readonly CandidateManifestEntry[];
}

function fail(code: string): never {
  throw new Error(`[PHASE5A1_CATALOG] ${code}`);
}

const candidateRoot = path.resolve(process.cwd(), "test-results", "phase5a1-catalog-candidates");
const manifestPath = path.join(candidateRoot, "manifest.json");
const evidencePath = path.join(candidateRoot, "evidence.json");
const expectedSourceSha = process.env.PHASE5A1_CATALOG_SOURCE_SHA;
const expectedPullRequestHeadSha = process.env.PHASE5A1_CATALOG_PR_HEAD_SHA ?? expectedSourceSha;
const repositoryRoot = path.resolve(process.cwd(), "..");
const expectedCandidatePaths = new Set(getCatalogCandidateRelativePaths());
const expectedPngPaths = new Set(getCatalogCandidatePngRelativePaths());
const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
const manifestKeys = [
  "schemaVersion",
  "kind",
  "sourceSha",
  "sourceTreeSha",
  "pullRequestHeadSha",
  "sourceState",
  "sourceWorktreeSha",
  "candidateStatus",
  "sceneCaptureCount",
  "interactionCaptureCount",
  "resilienceCaptureCount",
  "contactSheetCount",
  "evidenceRecordCount",
  "pngCount",
  "files",
] as const;
const manifestEntryKeys = ["path", "bytes", "sha256"] as const;

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

function parseJson<T>(filename: string, code: string): T {
  try {
    return JSON.parse(readFileSync(filename, "utf8")) as T;
  } catch {
    fail(code);
  }
}

function hasExactKeys(value: unknown, expectedKeys: readonly string[]): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index]);
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
if (!existsSync(evidencePath)) fail("candidate-evidence-missing");

const expectedDirectories = new Set(
  [...expectedPngPaths].map((candidatePath) => path.posix.dirname(candidatePath)),
);
const actualEntries = listCandidateEntries(candidateRoot);
if (
  actualEntries.directories.length !== expectedDirectories.size ||
  actualEntries.directories.some((directory) => !expectedDirectories.has(directory)) ||
  actualEntries.files.length !== CATALOG_CANDIDATE_FILE_COUNT ||
  !actualEntries.files.includes("manifest.json") ||
  actualEntries.files.some((filename) =>
    filename !== "manifest.json" && !expectedCandidatePaths.has(filename),
  )
) {
  fail("candidate-root-contents-invalid");
}

const manifest = parseJson<CandidateManifest>(manifestPath, "candidate-manifest-json-invalid");
if (
  !hasExactKeys(manifest, manifestKeys) ||
  Object.keys(manifest).some((key, index) => key !== manifestKeys[index]) ||
  !Array.isArray(manifest.files) ||
  manifest.schemaVersion !== 3 ||
  manifest.kind !== "phase5a1b-canonical-primitives-catalog-candidates" ||
  manifest.sourceSha !== expectedSourceSha ||
  manifest.sourceTreeSha !== checkoutTreeSha ||
  manifest.pullRequestHeadSha !== expectedPullRequestHeadSha ||
  manifest.sourceState !== checkoutSourceState ||
  manifest.sourceWorktreeSha !== checkoutWorktreeSha ||
  !/^[0-9a-f]{64}$/u.test(manifest.sourceWorktreeSha) ||
  manifest.candidateStatus !== "human-review-required-not-a-production-baseline" ||
  manifest.sceneCaptureCount !== CATALOG_SCENE_CAPTURE_COUNT ||
  manifest.interactionCaptureCount !== CATALOG_INTERACTION_CAPTURE_COUNT ||
  manifest.resilienceCaptureCount !== CATALOG_RESILIENCE_CAPTURE_COUNT ||
  manifest.contactSheetCount !== CATALOG_CONTACT_SHEET_COUNT ||
  manifest.evidenceRecordCount !== CATALOG_EVIDENCE_RECORD_COUNT ||
  manifest.pngCount !== CATALOG_PNG_COUNT ||
  manifest.files.length !== CATALOG_MANIFEST_ENTRY_COUNT
) {
  fail("candidate-manifest-contract-invalid");
}

const expectedManifestPaths = actualEntries.files.filter((filename) => filename !== "manifest.json");
if (
  manifest.files.some((entry, index) => entry.path !== expectedManifestPaths[index])
) {
  fail("candidate-manifest-order-invalid");
}

const paths = new Set<string>();
for (const entry of manifest.files) {
  if (
    !hasExactKeys(entry, manifestEntryKeys) ||
    Object.keys(entry).some((key, index) => key !== manifestEntryKeys[index]) ||
    paths.has(entry.path) ||
    !expectedCandidatePaths.has(entry.path) ||
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
  if (
    entry.path.endsWith(".png") &&
    (bytes.length < pngSignature.length || !bytes.subarray(0, pngSignature.length).equals(pngSignature))
  ) {
    fail("candidate-png-signature-invalid");
  }
  if (!entry.path.endsWith(".png") && entry.path !== "evidence.json") {
    fail("candidate-file-extension-invalid");
  }
}

if (readFileSync(manifestPath, "utf8") !== `${JSON.stringify(manifest, null, 2)}\n`) {
  fail("candidate-manifest-format-invalid");
}

if (
  paths.size !== expectedCandidatePaths.size ||
  [...expectedCandidatePaths].some((expectedPath) => !paths.has(expectedPath))
) {
  fail("candidate-manifest-path-matrix-invalid");
}

const evidence = parseJson<CatalogEvidence>(evidencePath, "candidate-evidence-json-invalid");
const expectedEvidence: CatalogEvidence = {
  schemaVersion: 1,
  kind: "phase5a1b-canonical-primitives-interaction-evidence",
  sourceSha: checkoutSourceSha,
  sourceTreeSha: checkoutTreeSha,
  pullRequestHeadSha: expectedPullRequestHeadSha,
  records: getCatalogExpectedEvidenceRecords(),
};
if (JSON.stringify(evidence) !== JSON.stringify(expectedEvidence)) {
  fail("candidate-evidence-contract-invalid");
}
if (readFileSync(evidencePath, "utf8") !== `${JSON.stringify(evidence, null, 2)}\n`) {
  fail("candidate-evidence-format-invalid");
}

const manifestChecksum = createHash("sha256")
  .update(readFileSync(manifestPath))
  .digest("hex");
const evidenceChecksum = createHash("sha256")
  .update(readFileSync(evidencePath))
  .digest("hex");
process.stdout.write(
  `[PHASE5A1_CATALOG] manifest-verified scenes=${CATALOG_SCENE_CAPTURE_COUNT} ` +
  `interactions=${CATALOG_INTERACTION_CAPTURE_COUNT} ` +
  `resilience=${CATALOG_RESILIENCE_CAPTURE_COUNT} contact-sheets=${CATALOG_CONTACT_SHEET_COUNT} ` +
  `pngs=${CATALOG_PNG_COUNT} manifest-sha256=${manifestChecksum} ` +
  `evidence-sha256=${evidenceChecksum}\n`,
);
