import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(root, "..", "..", "..", "..", "..");
const manifestPath = path.join(root, "manifest.json");
const sourceCommit = "6f675ffe8c4091ed98db2f53298fe4acc19f6895";
const sourceTree = "e82f1ce3b0f9fdfd8d41f02b04fb8d25a5b81da6";
const cycleOneTree = "e986591713654daf73a998b8bdb22318e01f4d5f";
const candidateOneEvidenceTree = "3830d5caf09deb439a66879945de0d96de5afa54";

function fail(code) {
  throw new Error(`[P5A3_CYCLE2_REPLACEMENT] ${code}`);
}

function git(...args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
  } catch {
    fail(`json-invalid:${relativePath}`);
  }
}

function sha256(absolutePath) {
  return createHash("sha256").update(readFileSync(absolutePath)).digest("hex");
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    const metadata = lstatSync(absolute);
    if (metadata.isSymbolicLink()) fail("symlink-forbidden");
    if (entry.isDirectory()) return walk(absolute);
    if (!entry.isFile()) fail("entry-invalid");
    return [path.relative(root, absolute).replaceAll("\\", "/")];
  });
}

if (realpathSync.native(root) !== root) fail("evidence-root-reparse");
const manifest = readJson("manifest.json");
if (
  manifest.schemaVersion !== 2 ||
  manifest.kind !== "phase5a3-landing-revision-cycle-2-replacement-manifest" ||
  manifest.productionSourceCommit !== sourceCommit ||
  manifest.productionSourceTree !== sourceTree ||
  !Array.isArray(manifest.files)
) {
  fail("manifest-contract-invalid");
}

const actualFiles = walk(root).filter((file) => file !== "manifest.json").sort();
const declaredFiles = manifest.files.map(({ path: file }) => file).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(declaredFiles)) {
  fail("manifest-file-set-mismatch");
}

let totalBytes = 0;
for (const entry of manifest.files) {
  if (
    typeof entry.path !== "string" ||
    !Number.isInteger(entry.bytes) ||
    !/^[0-9a-f]{64}$/u.test(entry.sha256)
  ) {
    fail("manifest-entry-invalid");
  }
  const absolute = path.resolve(root, entry.path);
  if (
    path.relative(root, absolute).startsWith("..") ||
    lstatSync(absolute).isSymbolicLink() ||
    !statSync(absolute).isFile()
  ) {
    fail(`manifest-path-invalid:${entry.path}`);
  }
  const bytes = statSync(absolute).size;
  totalBytes += bytes;
  if (bytes !== entry.bytes) fail(`manifest-bytes-mismatch:${entry.path}`);
  if (sha256(absolute) !== entry.sha256) fail(`manifest-sha256-mismatch:${entry.path}`);
  if (entry.path.endsWith(".json")) readJson(entry.path);
}
if (manifest.fileCount !== manifest.files.length || manifest.totalBytes !== totalBytes) {
  fail("manifest-summary-mismatch");
}

if (git("rev-parse", `${sourceCommit}^{tree}`) !== sourceTree) {
  fail("source-tree-mismatch");
}
if (git("rev-parse", "HEAD:docs/phase5a3/landing-pr1/revision-cycle-1") !== cycleOneTree) {
  fail("cycle-one-tree-mismatch");
}
if (
  git(
    "rev-parse",
    "23abb74545e87bbc2f4f3ad09e9673ef7982e4db:docs/phase5a3/landing-pr1/revision-cycle-2/evidence",
  ) !== candidateOneEvidenceTree
) {
  fail("candidate-one-evidence-tree-mismatch");
}
if (
  git("diff", "--name-only", "origin/main...HEAD", "--", "frontend/e2e/__screenshots__") !==
  ""
) {
  fail("immutable-baseline-mutated");
}

const candidateOneVerifier = path.resolve(
  root,
  "..",
  "..",
  "revision-cycle-2-candidate-1",
  "evidence",
  "verify-evidence.mjs",
);
execFileSync(process.execPath, [candidateOneVerifier], {
  cwd: repositoryRoot,
  encoding: "utf8",
  windowsHide: true,
});

const stills = actualFiles.filter((file) => file.startsWith("stills/") && file.endsWith(".png"));
const videos = actualFiles.filter((file) => file.startsWith("motion/") && file.endsWith(".webm"));
const social = actualFiles.filter((file) => file.startsWith("social/") && file.endsWith(".png"));
const mobileLhrs = actualFiles.filter(
  (file) => file.startsWith("lighthouse/mobile/") && file.endsWith(".report.json"),
);
const desktopLhrs = actualFiles.filter(
  (file) => file.startsWith("lighthouse/desktop/") && file.endsWith(".report.json"),
);
const linuxPngs = actualFiles.filter(
  (file) => file.startsWith("linux-candidate/candidates/") && file.endsWith(".png"),
);
if (
  stills.length !== 13 ||
  videos.length !== 2 ||
  social.length !== 2 ||
  mobileLhrs.length !== 5 ||
  desktopLhrs.length !== 5 ||
  linuxPngs.length !== 7
) {
  fail("governed-count-mismatch");
}

for (const ledger of [
  "truth-and-metadata.json",
  "social-previews.json",
  "geometry.json",
  "cross-browser.json",
  "video-validation.json",
  "route-js/summary.json",
]) {
  if (readJson(ledger).passed !== true) fail(`passing-ledger-red:${ledger}`);
}

const performance = readJson("performance.json");
if (
  performance.passed !== false ||
  performance.disposition !== "REVISE" ||
  performance.cohortPolicy.frozenCandidateCount !== 2 ||
  performance.cohortPolicy.maximumReplacementCandidates !== 1
) {
  fail("performance-disposition-invalid");
}
for (const sample of [
  ...performance.profiles.mobile.samples,
  ...performance.profiles.desktop.samples,
]) {
  if (sample.consoleErrorCount !== 0 || sample.unexpectedFirstParty4xxCount !== 0) {
    fail("first-party-runtime-debt-retained");
  }
}

const forensics = readJson("performance-forensics.json");
if (
  forensics.newCausalSourceIdentified !== false ||
  forensics.thirdSourceExperimentAuthorized !== false ||
  forensics.unchangedCohortRerunAuthorized !== false
) {
  fail("forensic-stop-contract-invalid");
}

const linux = readJson("linux-candidate/summary.json");
if (
  linux.byteIdentical !== true ||
  linux.determinismPassed !== true ||
  linux.visualAcceptancePassed !== false ||
  linux.disposition !== "REVISE"
) {
  fail("linux-disposition-invalid");
}

for (const ledger of ["verification.json", "ci-and-security.json"]) {
  const value = readJson(ledger);
  if (value.passed !== false || value.disposition !== "REVISE") {
    fail(`final-disposition-invalid:${ledger}`);
  }
}
if (readJson("truth-and-metadata.json").states.length !== 6) {
  fail("truth-matrix-incomplete");
}

console.log(
  `Cycle 2 replacement evidence verified: ${manifest.fileCount} files, ${manifest.totalBytes} bytes; disposition REVISE.`,
);
