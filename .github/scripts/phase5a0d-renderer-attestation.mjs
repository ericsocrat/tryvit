import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const MANIFEST_PATH =
  "frontend/e2e/__screenshots__/phase5a0d-manifest.json";

export const ATTESTATION_PATH =
  "docs/evidence/phase5a0d-renderer-runtime-attestation.json";

export const REQUIRED_REFRESH_PATHS = Object.freeze([
  ATTESTATION_PATH,
  MANIFEST_PATH,
]);

const MANIFEST_FILE = "phase5a0d-manifest.json";
const SHA256_PATTERN = /^(?:sha256:)?[0-9a-f]{64}$/u;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

function assertManifestChecksum(manifest) {
  const { manifestChecksum, ...payload } = manifest;
  assert.match(manifestChecksum ?? "", /^[0-9a-f]{64}$/u, "manifest-checksum-invalid");
  assert.equal(sha256Bytes(stableJson(payload)), manifestChecksum, "manifest-checksum-mismatch");
}

function exactKeys(value, keys, label) {
  assert.equal(
    value !== null && typeof value === "object" && !Array.isArray(value),
    true,
    `${label}-object-invalid`,
  );
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label}-keys-invalid`);
}

function normalizeDigest(value) {
  assert.match(value, SHA256_PATTERN, "attestation-archive-digest-invalid");
  return value.replace(/^sha256:/u, "");
}

function listRegularFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      const stat = lstatSync(absolute);
      assert.equal(stat.isSymbolicLink(), false, "candidate-symlink-forbidden");
      if (stat.isDirectory()) {
        visit(absolute);
      } else {
        assert.equal(stat.isFile(), true, "candidate-entry-invalid");
        files.push(relative(root, absolute).split(sep).join("/"));
      }
    }
  };
  visit(root);
  return files.sort();
}

function git(repositoryRoot, args, encoding = "utf8") {
  return execFileSync("git", ["-C", repositoryRoot, ...args], {
    encoding,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function gitBytes(repositoryRoot, revision, path) {
  return git(repositoryRoot, ["show", `${revision}:${path}`], null);
}

function manifestMetadata(manifest, bytes) {
  return {
    manifestSha256: sha256Bytes(bytes),
    manifestChecksum: manifest.manifestChecksum,
    sourceCommit: manifest.sourceCommit,
    runnerImageVersion: manifest.runner.imageVersion,
    versions: stableCopy(manifest.versions),
  };
}

export function assertChangedPaths(changedPaths) {
  assert.deepEqual(
    [...changedPaths].sort(),
    [...REQUIRED_REFRESH_PATHS].sort(),
    "renderer-attestation-scope-invalid",
  );
}

export function assertManifestTransition(baseManifest, nextManifest) {
  const normalizedBase = stableCopy(baseManifest);
  const normalizedNext = stableCopy(nextManifest);

  normalizedBase.sourceCommit = normalizedNext.sourceCommit;
  normalizedBase.runner = stableCopy(normalizedNext.runner);
  normalizedBase.versions = stableCopy(normalizedNext.versions);
  normalizedBase.manifestChecksum = normalizedNext.manifestChecksum;

  assert.deepEqual(normalizedNext, normalizedBase, "renderer-attestation-manifest-drift");
  assert.notEqual(
    `${JSON.stringify(baseManifest.runner)}\0${JSON.stringify(baseManifest.versions)}`,
    `${JSON.stringify(nextManifest.runner)}\0${JSON.stringify(nextManifest.versions)}`,
    "renderer-attestation-no-runtime-drift",
  );
}

function assertEvidence(evidence, expected) {
  exactKeys(
    evidence,
    ["schemaVersion", "attestationType", "baseCommit", "candidate", "oldManifest", "newManifest", "review"],
    "attestation",
  );
  assert.equal(evidence.schemaVersion, 1, "attestation-schema-invalid");
  assert.equal(
    evidence.attestationType,
    "phase5a0d-renderer-runtime-metadata-only",
    "attestation-type-invalid",
  );
  assert.equal(evidence.baseCommit, expected.baseSha, "attestation-base-invalid");

  exactKeys(
    evidence.candidate,
    ["workflowRunId", "workflowRunAttempt", "runCreatedAt", "runCompletedAt", "artifactId", "artifactName", "archiveDigest", "archiveBytes", "sourceCommit"],
    "attestation-candidate",
  );
  assert.equal(evidence.candidate.workflowRunId, expected.runId, "attestation-run-invalid");
  assert.equal(evidence.candidate.workflowRunAttempt, expected.runAttempt, "attestation-attempt-invalid");
  assert.equal(evidence.candidate.runCreatedAt, expected.runCreatedAt, "attestation-run-created-invalid");
  assert.equal(evidence.candidate.runCompletedAt, expected.runCompletedAt, "attestation-run-completed-invalid");
  assert.equal(evidence.candidate.artifactId, expected.artifactId, "attestation-artifact-invalid");
  assert.equal(evidence.candidate.artifactName, expected.artifactName, "attestation-artifact-name-invalid");
  assert.equal(normalizeDigest(evidence.candidate.archiveDigest), expected.archiveDigest, "attestation-digest-invalid");
  assert.equal(evidence.candidate.archiveBytes, expected.archiveBytes, "attestation-archive-size-invalid");
  assert.equal(evidence.candidate.sourceCommit, expected.baseSha, "attestation-source-invalid");

  assert.deepEqual(evidence.oldManifest, expected.oldMetadata, "attestation-old-metadata-invalid");
  assert.deepEqual(evidence.newManifest, expected.newMetadata, "attestation-new-metadata-invalid");

  exactKeys(evidence.review, ["result", "caseCount", "pngs"], "attestation-review");
  assert.equal(evidence.review.result, "approved-byte-identical", "attestation-review-invalid");
  assert.equal(evidence.review.caseCount, expected.pngs.length, "attestation-case-count-invalid");
  assert.deepEqual(evidence.review.pngs, expected.pngs, "attestation-png-review-invalid");
}

export function validateRendererAttestation(options) {
  const repositoryRoot = resolve(options.repositoryRoot);
  const candidateRoot = resolve(options.candidateRoot);
  assert.match(options.baseSha, COMMIT_PATTERN, "attestation-base-sha-invalid");
  assert.match(options.headSha, COMMIT_PATTERN, "attestation-head-sha-invalid");
  assert.notEqual(options.baseSha, options.headSha, "attestation-head-not-distinct");

  const changedPaths = git(repositoryRoot, [
    "diff",
    "--name-only",
    "--diff-filter=ACDMRTUXB",
    options.baseSha,
    options.headSha,
    "--",
  ])
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  assertChangedPaths(changedPaths);

  const baseManifestBytes = gitBytes(repositoryRoot, options.baseSha, MANIFEST_PATH);
  const nextManifestBytes = gitBytes(repositoryRoot, options.headSha, MANIFEST_PATH);
  const candidateManifestBytes = readFileSync(resolve(candidateRoot, MANIFEST_FILE));
  assert.deepEqual(candidateManifestBytes, nextManifestBytes, "candidate-manifest-not-committed-exactly");

  const baseManifest = JSON.parse(baseManifestBytes.toString("utf8"));
  const nextManifest = JSON.parse(nextManifestBytes.toString("utf8"));
  assertManifestChecksum(baseManifest);
  assertManifestChecksum(nextManifest);
  assertManifestTransition(baseManifest, nextManifest);
  assert.equal(nextManifest.sourceCommit, options.baseSha, "attestation-manifest-source-invalid");

  const pngs = nextManifest.cases
    .map((entry) => ({ file: entry.relativeFile, bytes: entry.bytes, sha256: entry.sha256 }))
    .sort((left, right) => left.file.localeCompare(right.file));
  assert.equal(pngs.length, 7, "attestation-case-matrix-invalid");
  assert.equal(new Set(pngs.map(({ file }) => file)).size, 7, "attestation-case-file-duplicate");

  const expectedCandidateFiles = [MANIFEST_FILE, ...pngs.map(({ file }) => file)].sort();
  assert.deepEqual(listRegularFiles(candidateRoot), expectedCandidateFiles, "candidate-file-set-invalid");

  for (const png of pngs) {
    const path = `frontend/e2e/__screenshots__/${png.file}`;
    const baseBytes = gitBytes(repositoryRoot, options.baseSha, path);
    const nextBytes = gitBytes(repositoryRoot, options.headSha, path);
    const candidateBytes = readFileSync(resolve(candidateRoot, png.file));
    assert.deepEqual(nextBytes, baseBytes, `committed-png-changed:${png.file}`);
    assert.deepEqual(candidateBytes, baseBytes, `candidate-png-changed:${png.file}`);
    assert.equal(candidateBytes.byteLength, png.bytes, `candidate-png-bytes-invalid:${png.file}`);
    assert.equal(sha256Bytes(candidateBytes), png.sha256, `candidate-png-sha-invalid:${png.file}`);
  }

  const oldMetadata = manifestMetadata(baseManifest, baseManifestBytes);
  const newMetadata = manifestMetadata(nextManifest, nextManifestBytes);
  const evidence = JSON.parse(
    gitBytes(repositoryRoot, options.headSha, ATTESTATION_PATH).toString("utf8"),
  );
  assertEvidence(evidence, {
    ...options,
    oldMetadata,
    newMetadata,
    pngs,
  });

  return {
    caseCount: pngs.length,
    oldMetadata,
    newMetadata,
  };
}

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    assert.match(key ?? "", /^--[a-z-]+$/u, "attestation-cli-argument-invalid");
    assert.notEqual(value, undefined, "attestation-cli-value-missing");
    result[key.slice(2)] = value;
  }
  return result;
}

function requiredInteger(value, label) {
  assert.match(value ?? "", /^[1-9][0-9]*$/u, `${label}-invalid`);
  return Number(value);
}

function requiredTimestamp(value, label) {
  assert.match(value ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u, `${label}-invalid`);
  return value;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const result = validateRendererAttestation({
    repositoryRoot: args["repository-root"],
    candidateRoot: args["candidate-root"],
    baseSha: args["base-sha"],
    headSha: args["head-sha"],
    runId: requiredInteger(args["run-id"], "run-id"),
    runAttempt: requiredInteger(args["run-attempt"], "run-attempt"),
    runCreatedAt: requiredTimestamp(args["run-created-at"], "run-created-at"),
    runCompletedAt: requiredTimestamp(args["run-completed-at"], "run-completed-at"),
    artifactId: requiredInteger(args["artifact-id"], "artifact-id"),
    artifactName: args["artifact-name"],
    archiveDigest: normalizeDigest(args["archive-digest"]),
    archiveBytes: requiredInteger(args["archive-bytes"], "archive-bytes"),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
