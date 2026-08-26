import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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

export const RENDERER_AUTHORIZATION_LABEL =
  "phase5a0d-renderer-attestation-approved";

export const SOURCE_EQUIVALENCE_APPROVAL_MARKER =
  "phase5a0d-renderer-source-equivalence-approval:v2";

export const RENDERER_ATTESTATION_BRANCH =
  "codex/phase-5a0d-renderer-runtime-attestation";

const MANIFEST_FILE = "phase5a0d-manifest.json";
const VISUAL_WORKFLOW_PATH = ".github/workflows/phase5a0d-visual-baselines.yml";
const DETERMINISM_FILES = Object.freeze([
  "first-files.sha256",
  "first-manifest.json",
  "provenance.json",
  "second-files.sha256",
  "second-manifest.json",
]);
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

function requiredPositiveInteger(value, label) {
  assert.equal(Number.isSafeInteger(value) && value > 0, true, `${label}-invalid`);
  return value;
}

function requiredIsoTimestamp(value, label) {
  assert.match(value ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u, `${label}-invalid`);
  return value;
}

function parseApprovalComment(body) {
  const escaped = SOURCE_EQUIVALENCE_APPROVAL_MARKER.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = body.match(new RegExp(`<!--\\s*${escaped}\\s*\\n([\\s\\S]*?)\\n\\s*-->`, "u"));
  assert.ok(match, "renderer-approval-marker-invalid");
  const approval = JSON.parse(match[1]);
  exactKeys(
    approval,
    ["schemaVersion", "approvalType", "attestationPrHead"],
    "renderer-approval",
  );
  assert.equal(approval.schemaVersion, 2, "renderer-approval-schema-invalid");
  assert.equal(
    approval.approvalType,
    "phase5a0d-renderer-source-equivalence",
    "renderer-approval-type-invalid",
  );
  assert.match(approval.attestationPrHead ?? "", COMMIT_PATTERN, "renderer-approval-head-invalid");
  return approval;
}

export function selectRendererSourceEquivalenceApproval({
  comments,
  events,
  owner,
  headSha,
  headRef,
  labels,
}) {
  assert.match(owner ?? "", /^[A-Za-z0-9-]+$/u, "renderer-approval-owner-invalid");
  assert.match(headSha ?? "", COMMIT_PATTERN, "renderer-approval-current-head-invalid");
  assert.equal(headRef, RENDERER_ATTESTATION_BRANCH, "renderer-approval-branch-invalid");
  assert.equal(Array.isArray(labels), true, "renderer-approval-labels-invalid");
  assert.equal(
    labels.includes(RENDERER_AUTHORIZATION_LABEL),
    true,
    "renderer-approval-label-missing",
  );

  const approvals = comments
    .filter(
      (comment) =>
        comment?.user?.login === owner &&
        comment?.author_association === "OWNER" &&
        typeof comment.body === "string" &&
        comment.body.includes(SOURCE_EQUIVALENCE_APPROVAL_MARKER),
    )
    .map((comment) => ({
      approval: parseApprovalComment(comment.body),
      commentId: requiredPositiveInteger(comment.id, "renderer-approval-comment-id"),
      createdAt: requiredIsoTimestamp(comment.created_at, "renderer-approval-comment-created"),
      updatedAt: requiredIsoTimestamp(comment.updated_at, "renderer-approval-comment-updated"),
    }))
    .filter((entry) => entry.approval.attestationPrHead === headSha)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  assert.equal(approvals.length > 0, true, "renderer-approval-owner-comment-missing");
  const selected = approvals[0];

  const labelEvents = events
    .filter(
      (event) =>
        event?.event === "labeled" &&
        event?.label?.name === RENDERER_AUTHORIZATION_LABEL &&
        event?.actor?.login === owner,
    )
    .map((event) => ({
      eventId: requiredPositiveInteger(event.id, "renderer-approval-label-event-id"),
      createdAt: requiredIsoTimestamp(event.created_at, "renderer-approval-label-created"),
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  assert.equal(labelEvents.length > 0, true, "renderer-approval-owner-label-event-missing");
  const labelEvent = labelEvents[0];
  assert.equal(
    labelEvent.createdAt >= selected.updatedAt,
    true,
    "renderer-approval-label-predates-comment",
  );

  return {
    approval: selected.approval,
    external: {
      owner,
      headRef,
      commentId: selected.commentId,
      commentCreatedAt: selected.createdAt,
      commentUpdatedAt: selected.updatedAt,
      labelEventId: labelEvent.eventId,
      labelCreatedAt: labelEvent.createdAt,
    },
  };
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

function assertCommitTree(repositoryRoot, source, label) {
  exactKeys(source, ["headSha", "tree"], label);
  assert.match(source.headSha ?? "", COMMIT_PATTERN, `${label}-head-invalid`);
  assert.match(source.tree ?? "", COMMIT_PATTERN, `${label}-tree-invalid`);
  assert.equal(
    git(repositoryRoot, ["rev-parse", `${source.headSha}^{tree}`]).trim(),
    source.tree,
    `${label}-tree-mismatch`,
  );
}

function runtimeLandingPaths(repositoryRoot, revision) {
  const routeLocal = git(repositoryRoot, [
    "ls-tree",
    "-r",
    "--name-only",
    revision,
    "--",
    "frontend/src/app/_landing-v2",
  ])
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .filter(
      (entry) =>
        /\.(?:css|ts|tsx)$/u.test(entry) &&
        !/\.test\.(?:ts|tsx)$/u.test(entry) &&
        !entry.endsWith("/LandingSocialCard.tsx"),
    );
  return [
    "frontend/src/app/page.tsx",
    "frontend/src/app/HomePageContent.tsx",
    "frontend/src/proxy.ts",
    ...routeLocal,
  ].sort();
}

export function assertRendererSourceEquivalent(repositoryRoot, candidateSha, synchronizedSha) {
  try {
    git(repositoryRoot, ["merge-base", "--is-ancestor", candidateSha, synchronizedSha]);
  } catch {
    assert.fail("renderer-candidate-source-not-ancestor");
  }
  const candidatePaths = runtimeLandingPaths(repositoryRoot, candidateSha);
  const synchronizedPaths = runtimeLandingPaths(repositoryRoot, synchronizedSha);
  assert.deepEqual(
    synchronizedPaths,
    candidatePaths,
    "renderer-landing-source-file-set-drift",
  );
  for (const path of candidatePaths) {
    assert.equal(
      git(repositoryRoot, ["rev-parse", `${candidateSha}:${path}`]).trim(),
      git(repositoryRoot, ["rev-parse", `${synchronizedSha}:${path}`]).trim(),
      `renderer-landing-source-drift:${path}`,
    );
  }
  for (const path of ["frontend/package.json", "frontend/package-lock.json"]) {
    assert.equal(
      git(repositoryRoot, ["rev-parse", `${candidateSha}:${path}`]).trim(),
      git(repositoryRoot, ["rev-parse", `${synchronizedSha}:${path}`]).trim(),
      `renderer-dependency-source-drift:${path}`,
    );
  }
  return candidatePaths;
}

function parseHashLedger(bytes, label) {
  const records = bytes
    .toString("utf8")
    .trim()
    .split(/\r?\n/u)
    .map((line) => {
      const match = line.match(/^([0-9a-f]{64})  \.\/(.+)$/u);
      assert.ok(match, `${label}-entry-invalid`);
      assert.equal(match[2].startsWith("/") || match[2].includes(".."), false, `${label}-path-invalid`);
      return { sha256: match[1], file: match[2] };
    });
  assert.equal(new Set(records.map(({ file }) => file)).size, records.length, `${label}-duplicate`);
  return records.sort((left, right) => left.file.localeCompare(right.file));
}

function assertDeterminismPacket({
  repositoryRoot,
  determinismRoot,
  candidateRoot,
  candidateManifestBytes,
  candidateManifest,
  candidateSource,
  pngs,
}) {
  assert.deepEqual(listRegularFiles(determinismRoot), DETERMINISM_FILES, "determinism-file-set-invalid");
  const firstManifest = readFileSync(resolve(determinismRoot, "first-manifest.json"));
  const secondManifest = readFileSync(resolve(determinismRoot, "second-manifest.json"));
  assert.deepEqual(firstManifest, candidateManifestBytes, "determinism-first-manifest-drift");
  assert.deepEqual(secondManifest, candidateManifestBytes, "determinism-second-manifest-drift");

  const firstLedgerBytes = readFileSync(resolve(determinismRoot, "first-files.sha256"));
  const secondLedgerBytes = readFileSync(resolve(determinismRoot, "second-files.sha256"));
  assert.deepEqual(secondLedgerBytes, firstLedgerBytes, "determinism-ledger-drift");
  const ledger = parseHashLedger(firstLedgerBytes, "determinism-ledger");
  const expectedFiles = [MANIFEST_FILE, ...pngs.map(({ file }) => file)].sort();
  assert.deepEqual(ledger.map(({ file }) => file), expectedFiles, "determinism-ledger-file-set-invalid");
  for (const record of ledger) {
    assert.equal(
      record.sha256,
      sha256Bytes(readFileSync(resolve(candidateRoot, record.file))),
      `determinism-ledger-hash-invalid:${record.file}`,
    );
  }

  const provenance = JSON.parse(readFileSync(resolve(determinismRoot, "provenance.json"), "utf8"));
  exactKeys(
    provenance,
    [
      "schemaVersion",
      "sourceCommit",
      "runner",
      "versions",
      "generatorArchiveSha256",
      "packageJsonSha256",
      "packageLockSha256",
      "byteIdentical",
    ],
    "determinism-provenance",
  );
  assert.equal(provenance.schemaVersion, 1, "determinism-schema-invalid");
  assert.equal(provenance.sourceCommit, candidateSource.headSha, "determinism-source-invalid");
  assert.deepEqual(provenance.runner, candidateManifest.runner, "determinism-runner-invalid");
  assert.deepEqual(provenance.versions, candidateManifest.versions, "determinism-versions-invalid");
  assert.match(provenance.generatorArchiveSha256 ?? "", /^[0-9a-f]{64}$/u, "determinism-generator-invalid");
  assert.equal(
    provenance.packageJsonSha256,
    sha256Bytes(gitBytes(repositoryRoot, candidateSource.headSha, "frontend/package.json")),
    "determinism-package-json-invalid",
  );
  assert.equal(
    provenance.packageLockSha256,
    sha256Bytes(gitBytes(repositoryRoot, candidateSource.headSha, "frontend/package-lock.json")),
    "determinism-package-lock-invalid",
  );
  assert.equal(provenance.byteIdentical, true, "determinism-byte-identity-invalid");
}

function assertV2ApprovalFile(approvalFile, headSha) {
  const selected = JSON.parse(readFileSync(approvalFile, "utf8"));
  exactKeys(selected, ["approval", "external"], "renderer-selected-approval");
  exactKeys(
    selected.approval,
    ["schemaVersion", "approvalType", "attestationPrHead"],
    "renderer-selected-approval-record",
  );
  assert.equal(selected.approval.schemaVersion, 2, "renderer-selected-approval-schema-invalid");
  assert.equal(
    selected.approval.approvalType,
    "phase5a0d-renderer-source-equivalence",
    "renderer-selected-approval-type-invalid",
  );
  assert.equal(selected.approval.attestationPrHead, headSha, "renderer-selected-approval-head-invalid");
  exactKeys(
    selected.external,
    [
      "owner",
      "headRef",
      "commentId",
      "commentCreatedAt",
      "commentUpdatedAt",
      "labelEventId",
      "labelCreatedAt",
    ],
    "renderer-selected-approval-external",
  );
  assert.equal(selected.external.headRef, RENDERER_ATTESTATION_BRANCH, "renderer-selected-approval-branch-invalid");
  requiredPositiveInteger(selected.external.commentId, "renderer-selected-approval-comment-id");
  requiredPositiveInteger(selected.external.labelEventId, "renderer-selected-approval-label-event-id");
  requiredIsoTimestamp(selected.external.commentCreatedAt, "renderer-selected-approval-comment-created");
  requiredIsoTimestamp(selected.external.commentUpdatedAt, "renderer-selected-approval-comment-updated");
  requiredIsoTimestamp(selected.external.labelCreatedAt, "renderer-selected-approval-label-created");
  assert.equal(
    selected.external.labelCreatedAt >= selected.external.commentUpdatedAt,
    true,
    "renderer-selected-approval-order-invalid",
  );
  return selected;
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

function assertV1Evidence(evidence, expected) {
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

function assertV2Evidence(evidence, expected) {
  exactKeys(
    evidence,
    [
      "schemaVersion",
      "attestationType",
      "baseCommit",
      "candidateSource",
      "synchronizedImplementation",
      "candidate",
      "oldManifest",
      "newManifest",
      "review",
    ],
    "attestation",
  );
  assert.equal(evidence.schemaVersion, 2, "attestation-schema-invalid");
  assert.equal(
    evidence.attestationType,
    "phase5a0d-renderer-runtime-source-equivalence",
    "attestation-type-invalid",
  );
  assert.equal(evidence.baseCommit, expected.baseSha, "attestation-base-invalid");
  assert.deepEqual(evidence.candidateSource, expected.candidateSource, "attestation-candidate-source-invalid");
  assert.deepEqual(
    evidence.synchronizedImplementation,
    expected.synchronizedImplementation,
    "attestation-synchronized-implementation-invalid",
  );

  exactKeys(
    evidence.candidate,
    [
      "workflowRunId",
      "workflowRunAttempt",
      "runCreatedAt",
      "runCompletedAt",
      "artifactId",
      "artifactName",
      "archiveDigest",
      "archiveBytes",
      "determinismArtifactId",
      "determinismArtifactName",
      "determinismArchiveDigest",
      "determinismArchiveBytes",
      "sourceCommit",
    ],
    "attestation-candidate",
  );
  const expectedCandidate = {
    workflowRunId: expected.runId,
    workflowRunAttempt: expected.runAttempt,
    runCreatedAt: expected.runCreatedAt,
    runCompletedAt: expected.runCompletedAt,
    artifactId: expected.artifactId,
    artifactName: expected.artifactName,
    archiveDigest: `sha256:${expected.archiveDigest}`,
    archiveBytes: expected.archiveBytes,
    determinismArtifactId: expected.determinismArtifactId,
    determinismArtifactName: expected.determinismArtifactName,
    determinismArchiveDigest: `sha256:${expected.determinismArchiveDigest}`,
    determinismArchiveBytes: expected.determinismArchiveBytes,
    sourceCommit: expected.candidateSource.headSha,
  };
  assert.deepEqual(evidence.candidate, expectedCandidate, "attestation-candidate-invalid");
  assert.deepEqual(evidence.oldManifest, expected.oldMetadata, "attestation-old-metadata-invalid");
  assert.deepEqual(evidence.newManifest, expected.newMetadata, "attestation-new-metadata-invalid");

  exactKeys(evidence.review, ["result", "caseCount", "pngs"], "attestation-review");
  assert.equal(evidence.review.result, "approved-byte-identical", "attestation-review-invalid");
  assert.equal(evidence.review.caseCount, expected.pngs.length, "attestation-case-count-invalid");
  assert.deepEqual(evidence.review.pngs, expected.pngs, "attestation-png-review-invalid");
}

function assertV2RunAndArtifacts({ run, artifacts, evidence, approval }) {
  assert.equal(run.id, evidence.candidate.workflowRunId, "candidate-run-id-invalid");
  assert.equal(run.event, "workflow_dispatch", "candidate-run-event-invalid");
  assert.equal(run.head_sha, evidence.candidateSource.headSha, "candidate-run-head-invalid");
  assert.equal(run.status, "completed", "candidate-run-status-invalid");
  assert.equal(run.conclusion, "success", "candidate-run-conclusion-invalid");
  assert.equal(run.run_attempt, evidence.candidate.workflowRunAttempt, "candidate-run-attempt-invalid");
  assert.equal(run.created_at, evidence.candidate.runCreatedAt, "candidate-run-created-invalid");
  assert.equal(run.updated_at, evidence.candidate.runCompletedAt, "candidate-run-completed-invalid");
  assert.equal(run.path, VISUAL_WORKFLOW_PATH, "candidate-run-workflow-invalid");
  assert.equal(
    evidence.candidate.runCompletedAt <= approval.external.commentUpdatedAt,
    true,
    "candidate-run-after-approval",
  );

  const records = Array.isArray(artifacts) ? artifacts : artifacts.artifacts;
  assert.equal(Array.isArray(records), true, "candidate-artifacts-invalid");
  for (const expected of [
    {
      id: evidence.candidate.artifactId,
      name: evidence.candidate.artifactName,
      digest: normalizeDigest(evidence.candidate.archiveDigest),
      bytes: evidence.candidate.archiveBytes,
    },
    {
      id: evidence.candidate.determinismArtifactId,
      name: evidence.candidate.determinismArtifactName,
      digest: normalizeDigest(evidence.candidate.determinismArchiveDigest),
      bytes: evidence.candidate.determinismArchiveBytes,
    },
  ]) {
    const matches = records.filter(
      (artifact) =>
        artifact.id === expected.id &&
        artifact.name === expected.name &&
        artifact.expired === false &&
        normalizeDigest(artifact.digest) === expected.digest &&
        artifact.size_in_bytes === expected.bytes,
    );
    assert.equal(matches.length, 1, `candidate-artifact-binding-invalid:${expected.id}`);
  }
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
  const evidence = JSON.parse(
    gitBytes(repositoryRoot, options.headSha, ATTESTATION_PATH).toString("utf8"),
  );
  const sourceEquivalent = evidence.schemaVersion === 2;
  assertManifestChecksum(baseManifest);
  assertManifestChecksum(nextManifest);
  assertManifestTransition(baseManifest, nextManifest);
  assert.equal(
    nextManifest.sourceCommit,
    sourceEquivalent ? evidence.candidateSource?.headSha : options.baseSha,
    "attestation-manifest-source-invalid",
  );

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
  if (sourceEquivalent) {
    assertCommitTree(repositoryRoot, evidence.candidateSource, "attestation-candidate-source");
    exactKeys(
      evidence.synchronizedImplementation,
      ["prNumber", "headSha", "tree"],
      "attestation-synchronized-implementation",
    );
    requiredPositiveInteger(
      evidence.synchronizedImplementation.prNumber,
      "attestation-synchronized-pr-number",
    );
    assertCommitTree(
      repositoryRoot,
      {
        headSha: evidence.synchronizedImplementation.headSha,
        tree: evidence.synchronizedImplementation.tree,
      },
      "attestation-synchronized-implementation",
    );
    assertRendererSourceEquivalent(
      repositoryRoot,
      evidence.candidateSource.headSha,
      evidence.synchronizedImplementation.headSha,
    );
    assert.equal(
      evidence.candidate.sourceCommit,
      evidence.candidateSource.headSha,
      "attestation-candidate-source-record-invalid",
    );
    const approval = assertV2ApprovalFile(resolve(options.approvalFile), options.headSha);
    const run = JSON.parse(readFileSync(resolve(options.runFile), "utf8"));
    const artifacts = JSON.parse(readFileSync(resolve(options.artifactsFile), "utf8"));
    assertV2RunAndArtifacts({ run, artifacts, evidence, approval });
    assertDeterminismPacket({
      repositoryRoot,
      determinismRoot: resolve(options.determinismRoot),
      candidateRoot,
      candidateManifestBytes,
      candidateManifest: nextManifest,
      candidateSource: evidence.candidateSource,
      pngs,
    });
    assertV2Evidence(evidence, {
      ...options,
      candidateSource: evidence.candidateSource,
      synchronizedImplementation: evidence.synchronizedImplementation,
      oldMetadata,
      newMetadata,
      pngs,
    });
  } else {
    assertV1Evidence(evidence, {
      ...options,
      oldMetadata,
      newMetadata,
      pngs,
    });
  }

  return {
    mode: sourceEquivalent ? "source-equivalence" : "exact-main",
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

function extractApprovalMain(args) {
  const selected = selectRendererSourceEquivalenceApproval({
    comments: JSON.parse(readFileSync(resolve(args["comments-file"]), "utf8")),
    events: JSON.parse(readFileSync(resolve(args["events-file"]), "utf8")),
    owner: args.owner,
    headSha: args["head-sha"],
    headRef: args["head-ref"],
    labels: JSON.parse(args["labels-json"]),
  });
  writeFileSync(resolve(args["approval-file"]), `${JSON.stringify(selected, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  writeFileSync(
    resolve(args["github-output"]),
    `approval_mode=source-equivalence\napproval_updated_at=${selected.external.commentUpdatedAt}\n`,
    { encoding: "utf8", flag: "a" },
  );
}

function validateMain(args) {
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
    determinismRoot: args["determinism-root"],
    approvalFile: args["approval-file"],
    runFile: args["run-file"],
    artifactsFile: args["artifacts-file"],
    determinismArtifactId: args["determinism-artifact-id"]
      ? requiredInteger(args["determinism-artifact-id"], "determinism-artifact-id")
      : undefined,
    determinismArtifactName: args["determinism-artifact-name"],
    determinismArchiveDigest: args["determinism-archive-digest"]
      ? normalizeDigest(args["determinism-archive-digest"])
      : undefined,
    determinismArchiveBytes: args["determinism-archive-bytes"]
      ? requiredInteger(args["determinism-archive-bytes"], "determinism-archive-bytes")
      : undefined,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function main() {
  const command = process.argv[2]?.startsWith("--") ? "validate" : process.argv[2];
  const args = parseArguments(process.argv.slice(command === "validate" ? 2 : 3));
  if (command === "extract-approval") {
    extractApprovalMain(args);
    return;
  }
  assert.equal(command, "validate", "attestation-command-invalid");
  validateMain(args);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
