import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  lstatSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const AUTHORIZATION_LABEL = "phase5a0d-intentional-redesign-approved";
export const APPROVAL_MARKER = "phase5a0d-intentional-redesign-approval:v1";
export const EQUIVALENCE_APPROVAL_MARKER =
  "phase5a0d-intentional-redesign-approval:v2";
export const APPROVAL_MARKERS = Object.freeze([
  APPROVAL_MARKER,
  EQUIVALENCE_APPROVAL_MARKER,
]);
export const MANIFEST_PATH =
  "frontend/e2e/__screenshots__/phase5a0d-manifest.json";
export const VISUAL_WORKFLOW_PATH =
  ".github/workflows/phase5a0d-visual-baselines.yml";
export const ACCEPTANCE_BRANCH_PATTERN = /^codex\/phase5a0d-accept-[a-z0-9-]+$/u;

const MANIFEST_FILE = "phase5a0d-manifest.json";
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^(?:sha256:)?[0-9a-f]{64}$/u;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const SAFE_TEXT_PATTERN = /^[A-Za-z0-9_.:+/-]+$/u;
const DETERMINISM_FILES = Object.freeze([
  "first-files.sha256",
  "first-manifest.json",
  "provenance.json",
  "second-files.sha256",
  "second-manifest.json",
]);

function sha256(value) {
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

function exactKeys(value, keys, label) {
  assert.equal(
    value !== null && typeof value === "object" && !Array.isArray(value),
    true,
    `${label}-object-invalid`,
  );
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label}-keys-invalid`);
}

function normalizeDigest(value, label = "archive-digest") {
  assert.match(value ?? "", SHA256_PATTERN, `${label}-invalid`);
  return value.replace(/^sha256:/u, "");
}

function requiredInteger(value, label) {
  assert.equal(Number.isSafeInteger(value) && value > 0, true, `${label}-invalid`);
  return value;
}

function requiredTimestamp(value, label) {
  assert.match(value ?? "", TIMESTAMP_PATTERN, `${label}-invalid`);
  return value;
}

function requiredSafeText(value, label) {
  assert.match(value ?? "", SAFE_TEXT_PATTERN, `${label}-invalid`);
  return value;
}

function normalizeAuthorizedPath(value) {
  assert.equal(typeof value, "string", "approval-path-invalid");
  assert.equal(value.includes("\\"), false, "approval-path-backslash");
  assert.equal(value.startsWith("/"), false, "approval-path-absolute");
  const parts = value.split("/");
  assert.equal(parts.includes("") || parts.includes(".") || parts.includes(".."), false, "approval-path-traversal");
  assert.match(
    value,
    /^frontend\/e2e\/__screenshots__\/(?:smoke-visual|authenticated-visual)\.spec\.ts\/p5a0d-[a-z0-9-]+\.png$/u,
    "approval-path-outside-baselines",
  );
  return value;
}

function validateCandidateRecord(candidate, label, sourceCommit) {
  exactKeys(
    candidate,
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
    label,
  );
  requiredInteger(candidate.workflowRunId, `${label}-run-id`);
  requiredInteger(candidate.workflowRunAttempt, `${label}-run-attempt`);
  requiredTimestamp(candidate.runCreatedAt, `${label}-run-created`);
  requiredTimestamp(candidate.runCompletedAt, `${label}-run-completed`);
  requiredInteger(candidate.artifactId, `${label}-artifact-id`);
  requiredSafeText(candidate.artifactName, `${label}-artifact-name`);
  normalizeDigest(candidate.archiveDigest, `${label}-artifact-digest`);
  requiredInteger(candidate.archiveBytes, `${label}-artifact-bytes`);
  requiredInteger(candidate.determinismArtifactId, `${label}-determinism-artifact-id`);
  requiredSafeText(candidate.determinismArtifactName, `${label}-determinism-artifact-name`);
  normalizeDigest(
    candidate.determinismArchiveDigest,
    `${label}-determinism-artifact-digest`,
  );
  requiredInteger(
    candidate.determinismArchiveBytes,
    `${label}-determinism-artifact-bytes`,
  );
  assert.match(candidate.sourceCommit ?? "", COMMIT_PATTERN, `${label}-source-invalid`);
  assert.equal(candidate.sourceCommit, sourceCommit, `${label}-source-mismatch`);
  assert.equal(
    candidate.artifactName,
    `phase5a0d-visual-baseline-candidates-${sourceCommit}`,
    `${label}-artifact-name-source-mismatch`,
  );
  assert.equal(
    candidate.determinismArtifactName,
    `phase5a0d-visual-determinism-evidence-${sourceCommit}`,
    `${label}-determinism-name-source-mismatch`,
  );
}

function validateSourceIdentity(source, label, includePrNumber, additionalKeys = []) {
  exactKeys(
    source,
    [
      ...(includePrNumber ? ["prNumber"] : []),
      "headSha",
      "tree",
      ...additionalKeys,
    ],
    label,
  );
  if (includePrNumber) requiredInteger(source.prNumber, `${label}-pr`);
  assert.match(source.headSha ?? "", COMMIT_PATTERN, `${label}-head-invalid`);
  assert.match(source.tree ?? "", COMMIT_PATTERN, `${label}-tree-invalid`);
}

function parseApprovalBody(body) {
  assert.equal(typeof body, "string", "approval-comment-body-invalid");
  const marker = APPROVAL_MARKERS.find((candidate) => body.includes(candidate));
  assert.ok(marker, "approval-comment-marker-missing");
  const pattern = new RegExp(
    `<!--\\s*${marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)\\n-->`,
    "u",
  );
  const match = pattern.exec(body);
  assert.ok(match, "approval-comment-marker-missing");
  const approval = JSON.parse(match[1]);
  if (marker === EQUIVALENCE_APPROVAL_MARKER) {
    exactKeys(
      approval,
      [
        "schemaVersion",
        "approvalType",
        "baselinePrHead",
        "approvedVisualSource",
        "synchronizedImplementation",
        "authorizedPaths",
      ],
      "approval",
    );
    assert.equal(approval.schemaVersion, 2, "approval-schema-invalid");
    assert.equal(
      approval.approvalType,
      "phase5a0d-approved-source-equivalence",
      "approval-type-invalid",
    );
    assert.match(approval.baselinePrHead ?? "", COMMIT_PATTERN, "approval-head-invalid");
    exactKeys(
      approval.approvedVisualSource,
      ["headSha", "tree", "candidate"],
      "approval-visual-source",
    );
    validateSourceIdentity(
      approval.approvedVisualSource,
      "approval-visual-source",
      false,
      ["candidate"],
    );
    validateCandidateRecord(
      approval.approvedVisualSource.candidate,
      "approval-reference-candidate",
      approval.approvedVisualSource.headSha,
    );
    exactKeys(
      approval.synchronizedImplementation,
      ["prNumber", "headSha", "tree", "equivalenceCandidate"],
      "approval-synchronized-implementation",
    );
    validateSourceIdentity(
      approval.synchronizedImplementation,
      "approval-synchronized-implementation",
      true,
      ["equivalenceCandidate"],
    );
    validateCandidateRecord(
      approval.synchronizedImplementation.equivalenceCandidate,
      "approval-equivalence-candidate",
      approval.synchronizedImplementation.headSha,
    );
    approval._mode = "source-equivalence";
  } else {
  exactKeys(
    approval,
    [
      "schemaVersion",
      "approvalType",
      "baselinePrHead",
      "approvedImplementation",
      "candidate",
      "authorizedPaths",
    ],
    "approval",
  );
  assert.equal(approval.schemaVersion, 1, "approval-schema-invalid");
  assert.equal(
    approval.approvalType,
    "phase5a0d-intentional-redesign",
    "approval-type-invalid",
  );
  assert.match(approval.baselinePrHead ?? "", COMMIT_PATTERN, "approval-head-invalid");

    validateSourceIdentity(approval.approvedImplementation, "approval-implementation", true);
    validateCandidateRecord(
      approval.candidate,
      "approval-candidate",
      approval.approvedImplementation.headSha,
    );
    approval._mode = "exact-head";
  }

  assert.equal(Array.isArray(approval.authorizedPaths), true, "approval-paths-invalid");
  assert.equal(approval.authorizedPaths.length > 0, true, "approval-paths-empty");
  approval.authorizedPaths = approval.authorizedPaths.map(normalizeAuthorizedPath).sort();
  assert.equal(
    new Set(approval.authorizedPaths).size,
    approval.authorizedPaths.length,
    "approval-paths-duplicate",
  );
  return approval;
}

export function selectExternalApproval({
  comments,
  events,
  owner,
  headSha,
  headRef,
  labels,
}) {
  assert.match(owner ?? "", /^[A-Za-z0-9-]+$/u, "approval-owner-invalid");
  assert.match(headSha ?? "", COMMIT_PATTERN, "approval-current-head-invalid");
  assert.match(headRef ?? "", ACCEPTANCE_BRANCH_PATTERN, "approval-branch-invalid");
  assert.equal(Array.isArray(labels), true, "approval-labels-invalid");
  assert.equal(labels.includes(AUTHORIZATION_LABEL), true, "approval-label-missing");

  const approvals = comments
    .filter(
      (comment) =>
        comment?.user?.login === owner &&
        comment?.author_association === "OWNER" &&
        typeof comment.body === "string" &&
        APPROVAL_MARKERS.some((marker) => comment.body.includes(marker)),
    )
    .map((comment) => ({
      approval: parseApprovalBody(comment.body),
      commentId: requiredInteger(comment.id, "approval-comment-id"),
      createdAt: requiredTimestamp(comment.created_at, "approval-comment-created"),
      updatedAt: requiredTimestamp(comment.updated_at, "approval-comment-updated"),
    }))
    .filter((entry) => entry.approval.baselinePrHead === headSha)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  assert.equal(approvals.length > 0, true, "approval-owner-comment-missing");
  const selected = approvals[0];

  const labelEvents = events
    .filter(
      (event) =>
        event?.event === "labeled" &&
        event?.label?.name === AUTHORIZATION_LABEL &&
        event?.actor?.login === owner,
    )
    .map((event) => ({
      eventId: requiredInteger(event.id, "approval-label-event-id"),
      createdAt: requiredTimestamp(event.created_at, "approval-label-created"),
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  assert.equal(labelEvents.length > 0, true, "approval-owner-label-event-missing");
  const labelEvent = labelEvents[0];
  assert.equal(
    labelEvent.createdAt >= selected.updatedAt,
    true,
    "approval-label-predates-comment",
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

export function assertChangedPathRecords(records, authorizedPaths) {
  const expected = [MANIFEST_PATH, ...authorizedPaths].sort();
  const actual = records.map(({ status, path }) => {
    assert.equal(status, "M", `baseline-change-status-invalid:${path}`);
    return path;
  });
  assert.deepEqual([...actual].sort(), expected, "intentional-redesign-scope-invalid");
}

export function assertManifestTransition(baseManifest, nextManifest, authorizedPaths) {
  const normalizedBase = stableCopy(baseManifest);
  const normalizedNext = stableCopy(nextManifest);
  const approved = new Set(authorizedPaths);

  assert.match(nextManifest.sourceCommit ?? "", COMMIT_PATTERN, "manifest-source-invalid");
  normalizedBase.sourceCommit = normalizedNext.sourceCommit;
  normalizedBase.manifestChecksum = normalizedNext.manifestChecksum;
  assert.equal(
    Array.isArray(baseManifest.cases) && Array.isArray(nextManifest.cases),
    true,
    "manifest-cases-invalid",
  );
  assert.equal(baseManifest.cases.length, nextManifest.cases.length, "manifest-case-count-drift");

  let changedCaseCount = 0;
  for (let index = 0; index < baseManifest.cases.length; index += 1) {
    const baseCase = baseManifest.cases[index];
    const nextCase = nextManifest.cases[index];
    const repositoryPath = `frontend/e2e/__screenshots__/${nextCase?.relativeFile ?? ""}`;
    if (approved.has(repositoryPath)) {
      normalizedBase.cases[index].sha256 = nextCase.sha256;
      normalizedBase.cases[index].bytes = nextCase.bytes;
      changedCaseCount += 1;
    }
  }
  assert.equal(changedCaseCount, approved.size, "manifest-authorized-case-mismatch");
  assert.deepEqual(normalizedNext, normalizedBase, "intentional-redesign-manifest-drift");

  for (const manifest of [baseManifest, nextManifest]) {
    const { manifestChecksum, ...payload } = manifest;
    assert.match(manifestChecksum ?? "", /^[0-9a-f]{64}$/u, "manifest-checksum-invalid");
    assert.equal(sha256(stableJson(payload)), manifestChecksum, "manifest-checksum-mismatch");
  }
}

function assertCandidateRunAndArtifacts(run, artifacts, candidate, approvalTime) {
  assert.equal(run.id, candidate.workflowRunId, "candidate-run-id-invalid");
  assert.equal(run.event, "workflow_dispatch", "candidate-run-event-invalid");
  assert.equal(run.head_sha, candidate.sourceCommit, "candidate-run-head-invalid");
  assert.equal(run.status, "completed", "candidate-run-status-invalid");
  assert.equal(run.conclusion, "success", "candidate-run-conclusion-invalid");
  assert.equal(run.run_attempt, candidate.workflowRunAttempt, "candidate-run-attempt-invalid");
  assert.equal(run.created_at, candidate.runCreatedAt, "candidate-run-created-invalid");
  assert.equal(run.updated_at, candidate.runCompletedAt, "candidate-run-completed-invalid");
  assert.equal(run.path, VISUAL_WORKFLOW_PATH, "candidate-run-workflow-invalid");
  assert.equal(candidate.runCreatedAt < candidate.runCompletedAt, true, "candidate-run-order-invalid");
  assert.equal(candidate.runCompletedAt <= approvalTime, true, "candidate-run-after-approval");

  const expectedArtifacts = [
    {
      id: candidate.artifactId,
      name: candidate.artifactName,
      digest: normalizeDigest(candidate.archiveDigest),
      bytes: candidate.archiveBytes,
    },
    {
      id: candidate.determinismArtifactId,
      name: candidate.determinismArtifactName,
      digest: normalizeDigest(candidate.determinismArchiveDigest),
      bytes: candidate.determinismArchiveBytes,
    },
  ];
  for (const expected of expectedArtifacts) {
    const matches = artifacts.filter(
      (artifact) =>
        artifact.id === expected.id &&
        artifact.name === expected.name &&
        artifact.expired === false &&
        normalizeDigest(artifact.digest, "github-artifact-digest") === expected.digest &&
        artifact.size_in_bytes === expected.bytes,
    );
    assert.equal(matches.length, 1, `candidate-artifact-invalid:${expected.name}`);
  }
}

export function assertRunAndArtifacts(run, artifacts, approval, approvalTime) {
  return assertCandidateRunAndArtifacts(
    run,
    artifacts,
    approval.candidate,
    approvalTime,
  );
}

function listRegularFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      const metadata = lstatSync(absolute);
      assert.equal(metadata.isSymbolicLink(), false, "artifact-symlink-forbidden");
      if (metadata.isDirectory()) visit(absolute);
      else {
        assert.equal(metadata.isFile(), true, "artifact-entry-invalid");
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
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
}

function gitBytes(repositoryRoot, revision, path) {
  return git(repositoryRoot, ["show", `${revision}:${path}`], null);
}

function approvalReference(approval) {
  return approval._mode === "source-equivalence"
    ? {
        source: approval.approvedVisualSource,
        candidate: approval.approvedVisualSource.candidate,
      }
    : {
        source: approval.approvedImplementation,
        candidate: approval.candidate,
      };
}

function approvalSynchronized(approval) {
  return approval._mode === "source-equivalence"
    ? {
        source: approval.synchronizedImplementation,
        candidate: approval.synchronizedImplementation.equivalenceCandidate,
      }
    : null;
}

function assertCommitTree(repositoryRoot, source, label) {
  const tree = git(repositoryRoot, ["rev-parse", `${source.headSha}^{tree}`]).trim();
  assert.equal(tree, source.tree, `${label}-tree-mismatch`);
}

export function assertVisualSourceAncestor(repositoryRoot, visualSha, synchronizedSha) {
  try {
    git(repositoryRoot, ["merge-base", "--is-ancestor", visualSha, synchronizedSha]);
  } catch {
    assert.fail("approved-visual-source-not-ancestor");
  }
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

export function assertNormalLandingSourceEquivalent(repositoryRoot, visualSha, synchronizedSha) {
  const visualPaths = runtimeLandingPaths(repositoryRoot, visualSha);
  const synchronizedPaths = runtimeLandingPaths(repositoryRoot, synchronizedSha);
  assert.deepEqual(
    synchronizedPaths,
    visualPaths,
    "approved-landing-render-file-set-drift",
  );
  for (const path of visualPaths) {
    assert.equal(
      git(repositoryRoot, ["rev-parse", `${visualSha}:${path}`]).trim(),
      git(repositoryRoot, ["rev-parse", `${synchronizedSha}:${path}`]).trim(),
      `approved-landing-render-source-drift:${path}`,
    );
  }
  return visualPaths;
}

export function assertEquivalentCandidateManifests(referenceManifest, equivalenceManifest) {
  const normalizedReference = stableCopy(referenceManifest);
  normalizedReference.sourceCommit = equivalenceManifest.sourceCommit;
  normalizedReference.runner = stableCopy(equivalenceManifest.runner);
  normalizedReference.versions = stableCopy(equivalenceManifest.versions);
  normalizedReference.manifestChecksum = equivalenceManifest.manifestChecksum;
  assert.deepEqual(
    equivalenceManifest,
    normalizedReference,
    "equivalence-candidate-manifest-drift",
  );
  for (const manifest of [referenceManifest, equivalenceManifest]) {
    const { manifestChecksum, ...payload } = manifest;
    assert.equal(
      sha256(stableJson(payload)),
      manifestChecksum,
      "equivalence-manifest-checksum-mismatch",
    );
  }
}

function parseChangedPathRecords(repositoryRoot, baseSha, headSha) {
  const output = git(repositoryRoot, [
    "diff",
    "--name-status",
    "--no-renames",
    baseSha,
    headSha,
    "--",
  ]).trim();
  if (!output) return [];
  return output.split(/\r?\n/u).map((line) => {
    const [status, path, extra] = line.split("\t");
    assert.equal(extra, undefined, "baseline-change-record-invalid");
    return { status, path };
  });
}

function parseLedger(value) {
  const records = new Map();
  for (const line of value.trim().split(/\r?\n/u)) {
    const match = /^([0-9a-f]{64})\s+\.\/(.+)$/u.exec(line);
    assert.ok(match, "determinism-ledger-line-invalid");
    assert.equal(records.has(match[2]), false, "determinism-ledger-path-duplicate");
    records.set(match[2], match[1]);
  }
  return records;
}

function assertDeterminism(determinismRoot, candidateRoot, candidateManifestBytes) {
  assert.deepEqual(listRegularFiles(determinismRoot), [...DETERMINISM_FILES]);
  const firstManifest = readFileSync(resolve(determinismRoot, "first-manifest.json"));
  const secondManifest = readFileSync(resolve(determinismRoot, "second-manifest.json"));
  assert.deepEqual(firstManifest, secondManifest, "determinism-manifest-mismatch");
  assert.deepEqual(firstManifest, candidateManifestBytes, "determinism-candidate-mismatch");

  const firstLedgerBytes = readFileSync(resolve(determinismRoot, "first-files.sha256"));
  const secondLedgerBytes = readFileSync(resolve(determinismRoot, "second-files.sha256"));
  assert.deepEqual(firstLedgerBytes, secondLedgerBytes, "determinism-ledger-mismatch");
  const ledger = parseLedger(firstLedgerBytes.toString("utf8"));
  const candidateFiles = listRegularFiles(candidateRoot);
  assert.equal(ledger.size, candidateFiles.length, "determinism-ledger-size-invalid");
  for (const file of candidateFiles) {
    assert.equal(
      ledger.get(file),
      sha256(readFileSync(resolve(candidateRoot, file))),
      `determinism-ledger-sha-invalid:${file}`,
    );
  }

  const provenance = JSON.parse(
    readFileSync(resolve(determinismRoot, "provenance.json"), "utf8"),
  );
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
  assert.equal(provenance.byteIdentical, true, "determinism-byte-identity-invalid");
  for (const field of [
    "generatorArchiveSha256",
    "packageJsonSha256",
    "packageLockSha256",
  ]) {
    assert.match(provenance[field] ?? "", /^[0-9a-f]{64}$/u, `determinism-${field}-invalid`);
  }
  return provenance;
}

export function validateIntentionalRedesign(options) {
  const repositoryRoot = resolve(options.repositoryRoot);
  const candidateRoot = resolve(options.candidateRoot);
  const determinismRoot = resolve(options.determinismRoot);
  assert.match(options.baseSha ?? "", COMMIT_PATTERN, "baseline-base-sha-invalid");
  assert.match(options.headSha ?? "", COMMIT_PATTERN, "baseline-head-sha-invalid");
  assert.notEqual(options.baseSha, options.headSha, "baseline-head-not-distinct");

  const externalApproval = JSON.parse(readFileSync(options.approvalFile, "utf8"));
  exactKeys(externalApproval, ["approval", "external"], "external-approval");
  const approval = externalApproval.approval;
  assert.equal(approval.baselinePrHead, options.headSha, "approval-head-mismatch");
  const reference = approvalReference(approval);
  const synchronized = approvalSynchronized(approval);
  assertCommitTree(repositoryRoot, reference.source, "approval-reference-source");
  let equivalentRenderPaths = [];
  if (synchronized) {
    assertCommitTree(
      repositoryRoot,
      synchronized.source,
      "approval-synchronized-implementation",
    );
    assertVisualSourceAncestor(
      repositoryRoot,
      reference.source.headSha,
      synchronized.source.headSha,
    );
    equivalentRenderPaths = assertNormalLandingSourceEquivalent(
      repositoryRoot,
      reference.source.headSha,
      synchronized.source.headSha,
    );
  }

  const changedRecords = parseChangedPathRecords(
    repositoryRoot,
    options.baseSha,
    options.headSha,
  );
  assertChangedPathRecords(changedRecords, approval.authorizedPaths);

  const baseManifestBytes = gitBytes(repositoryRoot, options.baseSha, MANIFEST_PATH);
  const nextManifestBytes = gitBytes(repositoryRoot, options.headSha, MANIFEST_PATH);
  const candidateManifestBytes = readFileSync(resolve(candidateRoot, MANIFEST_FILE));
  assert.deepEqual(
    candidateManifestBytes,
    nextManifestBytes,
    "candidate-manifest-not-committed-exactly",
  );
  const baseManifest = JSON.parse(baseManifestBytes.toString("utf8"));
  const nextManifest = JSON.parse(nextManifestBytes.toString("utf8"));
  assert.equal(
    nextManifest.sourceCommit,
    reference.source.headSha,
    "manifest-approved-source-mismatch",
  );
  assertManifestTransition(baseManifest, nextManifest, approval.authorizedPaths);

  const expectedCandidateFiles = [
    MANIFEST_FILE,
    ...nextManifest.cases.map((entry) => entry.relativeFile),
  ].sort();
  assert.deepEqual(listRegularFiles(candidateRoot), expectedCandidateFiles, "candidate-file-set-invalid");
  const authorized = new Set(approval.authorizedPaths);
  for (const entry of nextManifest.cases) {
    const repositoryPath = `frontend/e2e/__screenshots__/${entry.relativeFile}`;
    const baseBytes = gitBytes(repositoryRoot, options.baseSha, repositoryPath);
    const headBytes = gitBytes(repositoryRoot, options.headSha, repositoryPath);
    const candidateBytes = readFileSync(resolve(candidateRoot, entry.relativeFile));
    assert.equal(candidateBytes.byteLength, entry.bytes, `candidate-bytes-invalid:${entry.id}`);
    assert.equal(sha256(candidateBytes), entry.sha256, `candidate-sha-invalid:${entry.id}`);
    assert.deepEqual(headBytes, candidateBytes, `candidate-not-committed:${entry.id}`);
    if (authorized.has(repositoryPath)) {
      assert.notDeepEqual(headBytes, baseBytes, `approved-baseline-unchanged:${entry.id}`);
    } else {
      assert.deepEqual(headBytes, baseBytes, `unapproved-baseline-changed:${entry.id}`);
      assert.deepEqual(candidateBytes, baseBytes, `unapproved-candidate-changed:${entry.id}`);
    }
  }

  const provenance = assertDeterminism(
    determinismRoot,
    candidateRoot,
    candidateManifestBytes,
  );
  assert.equal(
    provenance.sourceCommit,
    reference.candidate.sourceCommit,
    "determinism-source-invalid",
  );
  assert.deepEqual(provenance.runner, nextManifest.runner, "determinism-runner-invalid");
  assert.deepEqual(provenance.versions, nextManifest.versions, "determinism-versions-invalid");

  const run = JSON.parse(readFileSync(options.runFile, "utf8"));
  const artifactsPayload = JSON.parse(readFileSync(options.artifactsFile, "utf8"));
  assert.equal(Array.isArray(artifactsPayload.artifacts), true, "github-artifacts-invalid");
  assertCandidateRunAndArtifacts(
    run,
    artifactsPayload.artifacts,
    reference.candidate,
    externalApproval.external.commentUpdatedAt,
  );

  if (synchronized) {
    const equivalenceCandidateRoot = resolve(options.equivalenceCandidateRoot);
    const equivalenceDeterminismRoot = resolve(options.equivalenceDeterminismRoot);
    const equivalenceManifestBytes = readFileSync(
      resolve(equivalenceCandidateRoot, MANIFEST_FILE),
    );
    const equivalenceManifest = JSON.parse(equivalenceManifestBytes.toString("utf8"));
    assert.equal(
      equivalenceManifest.sourceCommit,
      synchronized.source.headSha,
      "equivalence-manifest-source-invalid",
    );
    assertEquivalentCandidateManifests(nextManifest, equivalenceManifest);
    assert.deepEqual(
      listRegularFiles(equivalenceCandidateRoot),
      expectedCandidateFiles,
      "equivalence-candidate-file-set-invalid",
    );
    for (const entry of nextManifest.cases) {
      assert.deepEqual(
        readFileSync(resolve(equivalenceCandidateRoot, entry.relativeFile)),
        readFileSync(resolve(candidateRoot, entry.relativeFile)),
        `equivalence-candidate-png-drift:${entry.id}`,
      );
    }
    const equivalenceProvenance = assertDeterminism(
      equivalenceDeterminismRoot,
      equivalenceCandidateRoot,
      equivalenceManifestBytes,
    );
    assert.equal(
      equivalenceProvenance.sourceCommit,
      synchronized.candidate.sourceCommit,
      "equivalence-determinism-source-invalid",
    );
    assert.deepEqual(
      equivalenceProvenance.runner,
      equivalenceManifest.runner,
      "equivalence-determinism-runner-invalid",
    );
    assert.deepEqual(
      equivalenceProvenance.versions,
      equivalenceManifest.versions,
      "equivalence-determinism-versions-invalid",
    );
    const equivalenceRun = JSON.parse(readFileSync(options.equivalenceRunFile, "utf8"));
    const equivalenceArtifacts = JSON.parse(
      readFileSync(options.equivalenceArtifactsFile, "utf8"),
    );
    assert.equal(
      Array.isArray(equivalenceArtifacts.artifacts),
      true,
      "equivalence-github-artifacts-invalid",
    );
    assertCandidateRunAndArtifacts(
      equivalenceRun,
      equivalenceArtifacts.artifacts,
      synchronized.candidate,
      externalApproval.external.commentUpdatedAt,
    );
  }

  return {
    approvalMode: approval._mode,
    approvedVisualSource: reference.source,
    synchronizedImplementation: synchronized?.source ?? reference.source,
    authorizedPaths: approval.authorizedPaths,
    candidateRunId: reference.candidate.workflowRunId,
    equivalenceRunId: synchronized?.candidate.workflowRunId ?? null,
    equivalentRenderPaths,
    commentId: externalApproval.external.commentId,
    labelEventId: externalApproval.external.labelEventId,
  };
}

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    assert.match(key ?? "", /^--[a-z-]+$/u, "cli-argument-invalid");
    assert.notEqual(value, undefined, "cli-value-missing");
    result[key.slice(2)] = value;
  }
  return result;
}

function requiredArgument(args, name) {
  const value = args[name];
  assert.equal(typeof value === "string" && value.length > 0, true, `cli-${name}-required`);
  return value;
}

function writeApprovalOutputs(result, outputFile) {
  const reference = approvalReference(result.approval);
  const synchronized = approvalSynchronized(result.approval);
  const candidate = reference.candidate;
  const values = {
    approval_mode: result.approval._mode,
    source_commit: candidate.sourceCommit,
    run_id: candidate.workflowRunId,
    artifact_id: candidate.artifactId,
    artifact_name: candidate.artifactName,
    archive_digest: candidate.archiveDigest,
    archive_bytes: candidate.archiveBytes,
    determinism_artifact_id: candidate.determinismArtifactId,
    determinism_artifact_name: candidate.determinismArtifactName,
    determinism_archive_digest: candidate.determinismArchiveDigest,
    determinism_archive_bytes: candidate.determinismArchiveBytes,
  };
  if (synchronized) {
    Object.assign(values, {
      equivalence_source_commit: synchronized.candidate.sourceCommit,
      equivalence_run_id: synchronized.candidate.workflowRunId,
      equivalence_artifact_id: synchronized.candidate.artifactId,
      equivalence_artifact_name: synchronized.candidate.artifactName,
      equivalence_archive_digest: synchronized.candidate.archiveDigest,
      equivalence_archive_bytes: synchronized.candidate.archiveBytes,
      equivalence_determinism_artifact_id:
        synchronized.candidate.determinismArtifactId,
      equivalence_determinism_artifact_name:
        synchronized.candidate.determinismArtifactName,
      equivalence_determinism_archive_digest:
        synchronized.candidate.determinismArchiveDigest,
      equivalence_determinism_archive_bytes:
        synchronized.candidate.determinismArchiveBytes,
    });
  }
  for (const [key, value] of Object.entries(values)) {
    const rendered = String(value);
    assert.match(rendered, /^[A-Za-z0-9_.:+-]+$/u, `approval-output-unsafe:${key}`);
    appendFileSync(outputFile, `${key}=${rendered}\n`);
  }
}

function main() {
  const command = process.argv[2];
  const args = parseArguments(process.argv.slice(3));
  if (command === "extract-approval") {
    const result = selectExternalApproval({
      comments: JSON.parse(readFileSync(requiredArgument(args, "comments-file"), "utf8")),
      events: JSON.parse(readFileSync(requiredArgument(args, "events-file"), "utf8")),
      owner: requiredArgument(args, "owner"),
      headSha: requiredArgument(args, "head-sha"),
      headRef: requiredArgument(args, "head-ref"),
      labels: JSON.parse(requiredArgument(args, "labels-json")),
    });
    writeFileSync(requiredArgument(args, "approval-file"), `${JSON.stringify(result, null, 2)}\n`);
    writeApprovalOutputs(result, requiredArgument(args, "github-output"));
    process.stdout.write(`${JSON.stringify(result.external)}\n`);
    return;
  }
  if (command === "validate") {
    const result = validateIntentionalRedesign({
      repositoryRoot: requiredArgument(args, "repository-root"),
      candidateRoot: requiredArgument(args, "candidate-root"),
      determinismRoot: requiredArgument(args, "determinism-root"),
      approvalFile: requiredArgument(args, "approval-file"),
      runFile: requiredArgument(args, "run-file"),
      artifactsFile: requiredArgument(args, "artifacts-file"),
      equivalenceCandidateRoot: args["equivalence-candidate-root"],
      equivalenceDeterminismRoot: args["equivalence-determinism-root"],
      equivalenceRunFile: args["equivalence-run-file"],
      equivalenceArtifactsFile: args["equivalence-artifacts-file"],
      baseSha: requiredArgument(args, "base-sha"),
      headSha: requiredArgument(args, "head-sha"),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  throw new Error("intentional-redesign-command-invalid");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "intentional-redesign-unknown-failure"}\n`);
    process.exitCode = 1;
  }
}
