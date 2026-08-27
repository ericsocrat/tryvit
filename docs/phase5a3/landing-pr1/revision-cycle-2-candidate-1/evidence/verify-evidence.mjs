import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(root, "..", "..", "..", "..", "..");
const manifestPath = path.join(root, "manifest.json");
const sourceCommit = "14c8b19fc7aa59f58811ef96989291e2b3893bfe";
const sourceTree = "251c6622f14ebfbf170882d33dafe326509da2a8";
const cycleOneTree = "e986591713654daf73a998b8bdb22318e01f4d5f";

function fail(code) {
  throw new Error(`[P5A3_CYCLE2_EVIDENCE] ${code}`);
}

function git(...args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

function readJson(relativePath) {
  const absolute = path.join(root, relativePath);
  try {
    return JSON.parse(readFileSync(absolute, "utf8"));
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
  manifest.schemaVersion !== 1 ||
  manifest.kind !== "phase5a3-landing-revision-cycle-2-manifest" ||
  manifest.productionSourceCommit !== sourceCommit ||
  manifest.productionSourceTree !== sourceTree ||
  !Array.isArray(manifest.files)
) {
  fail("manifest-contract-invalid");
}

const actualFiles = walk(root)
  .filter((relativePath) => relativePath !== "manifest.json")
  .sort();
const declaredFiles = manifest.files.map(({ path: relativePath }) => relativePath).sort();
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
  fail("production-source-tree-mismatch");
}
if (
  git("rev-parse", "HEAD:docs/phase5a3/landing-pr1/revision-cycle-1") !== cycleOneTree
) {
  fail("cycle-one-tree-mismatch");
}
if (
  git(
    "diff",
    "--name-only",
    sourceCommit,
    "ab0a43ecfcfbb064553a02a722263fda07b06ae8",
  ) !== "frontend/e2e/smoke-responsive.spec.ts"
) {
  fail("test-head-production-equivalence-mismatch");
}
if (
  git(
    "diff",
    "--name-only",
    "origin/main...HEAD",
    "--",
    "frontend/e2e/__screenshots__",
  ) !== ""
) {
  fail("immutable-baseline-mutated");
}

const stills = actualFiles.filter((file) => file.startsWith("stills/") && file.endsWith(".png"));
const videos = actualFiles.filter((file) => file.startsWith("motion/") && file.endsWith(".webm"));
const mobileLhrs = actualFiles.filter(
  (file) => file.startsWith("lighthouse/mobile/") && file.endsWith(".report.json"),
);
const desktopLhrs = actualFiles.filter(
  (file) => file.startsWith("lighthouse/desktop/") && file.endsWith(".report.json"),
);
if (stills.length !== 13 || videos.length !== 2 || mobileLhrs.length !== 5 || desktopLhrs.length !== 5) {
  fail("governed-artifact-count-mismatch");
}

for (const ledger of [
  "performance.json",
  "geometry.json",
  "cross-browser.json",
  "truth-and-metadata.json",
  "video-validation.json",
  "route-js/summary.json",
  "linux-candidate/summary.json",
]) {
  if (readJson(ledger).passed !== true) fail(`ledger-not-passing:${ledger}`);
}
if (readJson("truth-and-metadata.json").states.length !== 6) {
  fail("truth-matrix-incomplete");
}
if (readJson("linux-candidate/summary.json").byteIdentical !== true) {
  fail("linux-determinism-failed");
}

console.log(
  `Cycle 2 evidence verified: ${manifest.fileCount} files, ${manifest.totalBytes} bytes.`,
);
