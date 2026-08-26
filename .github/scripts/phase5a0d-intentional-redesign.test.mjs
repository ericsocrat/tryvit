import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  APPROVAL_MARKER,
  AUTHORIZATION_LABEL,
  MANIFEST_PATH,
  assertChangedPathRecords,
  assertManifestTransition,
  assertRunAndArtifacts,
  selectExternalApproval,
  validateIntentionalRedesign,
} from "./phase5a0d-intentional-redesign.mjs";

const OWNER = "ericsocrat";
const HEAD = "b".repeat(40);
const TREE = "c".repeat(40);
const RUN_CREATED = "2026-08-26T10:00:00Z";
const RUN_COMPLETED = "2026-08-26T10:30:00Z";
const COMMENT_CREATED = "2026-08-26T10:31:00Z";
const LABEL_CREATED = "2026-08-26T10:32:00Z";
const LANDING_PATHS = Object.freeze([
  "frontend/e2e/__screenshots__/smoke-visual.spec.ts/p5a0d-landing-390x844-light-reduced.png",
  "frontend/e2e/__screenshots__/smoke-visual.spec.ts/p5a0d-landing-768x1024-light-reduced.png",
  "frontend/e2e/__screenshots__/smoke-visual.spec.ts/p5a0d-landing-1440x900-light-reduced.png",
]);
const repositoryRoot = new URL("../../", import.meta.url);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

function approval(head = HEAD) {
  return {
    schemaVersion: 1,
    approvalType: "phase5a0d-intentional-redesign",
    baselinePrHead: head,
    approvedImplementation: {
      prNumber: 1301,
      headSha: HEAD,
      tree: TREE,
    },
    candidate: {
      workflowRunId: 123,
      workflowRunAttempt: 1,
      runCreatedAt: RUN_CREATED,
      runCompletedAt: RUN_COMPLETED,
      artifactId: 456,
      artifactName: `phase5a0d-visual-baseline-candidates-${HEAD}`,
      archiveDigest: `sha256:${"d".repeat(64)}`,
      archiveBytes: 1000,
      determinismArtifactId: 457,
      determinismArtifactName: `phase5a0d-visual-determinism-evidence-${HEAD}`,
      determinismArchiveDigest: `sha256:${"e".repeat(64)}`,
      determinismArchiveBytes: 500,
      sourceCommit: HEAD,
    },
    authorizedPaths: [...LANDING_PATHS],
  };
}

function approvalComment(value = approval()) {
  return {
    id: 100,
    user: { login: OWNER },
    author_association: "OWNER",
    created_at: COMMENT_CREATED,
    updated_at: COMMENT_CREATED,
    body: `<!-- ${APPROVAL_MARKER}\n${JSON.stringify(value)}\n-->`,
  };
}

function labelEvent(createdAt = LABEL_CREATED, actor = OWNER) {
  return {
    id: 200,
    event: "labeled",
    label: { name: AUTHORIZATION_LABEL },
    actor: { login: actor },
    created_at: createdAt,
  };
}

function select(overrides = {}) {
  return selectExternalApproval({
    comments: [approvalComment()],
    events: [labelEvent()],
    owner: OWNER,
    headSha: HEAD,
    headRef: "codex/phase5a0d-accept-landing-1301",
    labels: [AUTHORIZATION_LABEL],
    ...overrides,
  });
}

test("accepts a fresh owner authorization bound to the exact head", () => {
  const result = select();
  assert.equal(result.approval.baselinePrHead, HEAD);
  assert.equal(result.external.commentId, 100);
  assert.equal(result.external.labelEventId, 200);
});

test("rejects missing, stale, unauthorized, and wrong-branch approval", () => {
  assert.throws(() => select({ labels: [] }), /approval-label-missing/u);
  assert.throws(
    () => select({ events: [labelEvent("2026-08-26T10:29:00Z")] }),
    /approval-label-predates-comment/u,
  );
  assert.throws(
    () => select({ events: [labelEvent(LABEL_CREATED, "attacker")] }),
    /approval-owner-label-event-missing/u,
  );
  assert.throws(
    () => select({ comments: [{ ...approvalComment(), author_association: "CONTRIBUTOR" }] }),
    /approval-owner-comment-missing/u,
  );
  assert.throws(
    () => select({ headRef: "feature/accept-everything" }),
    /approval-branch-invalid/u,
  );
  assert.throws(
    () => select({ headSha: "f".repeat(40) }),
    /approval-owner-comment-missing/u,
  );
});

test("rejects unsafe or internally inconsistent approval data", () => {
  const wrongSource = approval();
  wrongSource.candidate.sourceCommit = "f".repeat(40);
  assert.throws(
    () => select({ comments: [approvalComment(wrongSource)] }),
    /approval-source-implementation-mismatch/u,
  );

  const traversal = approval();
  traversal.authorizedPaths[0] = "frontend/e2e/__screenshots__/../secret.png";
  assert.throws(
    () => select({ comments: [approvalComment(traversal)] }),
    /approval-path-traversal/u,
  );

  const duplicate = approval();
  duplicate.authorizedPaths[1] = duplicate.authorizedPaths[0];
  assert.throws(
    () => select({ comments: [approvalComment(duplicate)] }),
    /approval-paths-duplicate/u,
  );
});

test("accepts only the manifest and exactly authorized modified PNG paths", () => {
  const records = [
    { status: "M", path: MANIFEST_PATH },
    ...LANDING_PATHS.map((entry) => ({ status: "M", path: entry })),
  ];
  assert.doesNotThrow(() => assertChangedPathRecords(records, LANDING_PATHS));
  assert.throws(
    () =>
      assertChangedPathRecords(
        [...records, { status: "M", path: "frontend/src/app/page.tsx" }],
        LANDING_PATHS,
      ),
    /intentional-redesign-scope-invalid/u,
  );
  assert.throws(
    () => assertChangedPathRecords([{ status: "A", path: MANIFEST_PATH }], []),
    /baseline-change-status-invalid/u,
  );
});

function manifest() {
  const cases = [
    ["landing-390x844", "smoke-visual.spec.ts/p5a0d-landing-390x844-light-reduced.png"],
    ["landing-768x1024", "smoke-visual.spec.ts/p5a0d-landing-768x1024-light-reduced.png"],
    ["landing-1440x900", "smoke-visual.spec.ts/p5a0d-landing-1440x900-light-reduced.png"],
    ["login-390x844", "smoke-visual.spec.ts/p5a0d-login-390x844-light-reduced.png"],
    ["login-1440x900", "smoke-visual.spec.ts/p5a0d-login-1440x900-light-reduced.png"],
    ["app-shell-390x844", "authenticated-visual.spec.ts/p5a0d-app-shell-new-user-390x844-light-reduced.png"],
    ["app-shell-1440x900", "authenticated-visual.spec.ts/p5a0d-app-shell-new-user-1440x900-light-reduced.png"],
  ].map(([id, relativeFile], index) => ({
    id,
    mode: relativeFile.startsWith("smoke") ? "public" : "local-authenticated",
    routeId: id.startsWith("landing") ? "landing" : id.startsWith("login") ? "login" : "app-shell",
    path: id.startsWith("landing") ? "/" : id.startsWith("login") ? "/auth/login" : "/app",
    width: id.includes("1440") ? 1440 : id.includes("768") ? 768 : 390,
    height: id.includes("1440") ? 900 : id.includes("768") ? 1024 : 844,
    fixtureState: relativeFile.startsWith("smoke") ? "public-static" : "local-authenticated-new-user",
    relativeFile,
    sha256: String(index + 1).repeat(64),
    bytes: 100 + index,
  }));
  const payload = {
    schemaVersion: 1,
    kind: "phase5a0d-visual-baselines",
    sourceCommit: "a".repeat(40),
    rendererClass: "ci-linux-authoritative",
    runner: { imageOS: "ubuntu24", imageVersion: "20260816.277.1", arch: "x64" },
    versions: {
      node: "v22.21.1",
      npm: "10.9.4",
      next: "16.2.12",
      playwright: "1.62.1",
      chromium: "151.0.7922.34",
    },
    settings: {
      locale: "en-US",
      timezoneId: "UTC",
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
      fixedTime: "2026-07-15T12:00:00.000Z",
      fullPage: false,
      masks: [],
      maxDiffPixelRatio: 0.003,
      channelThreshold: 0.2,
    },
    fixtureContractChecksum: "f".repeat(64),
    cases,
  };
  return { ...payload, manifestChecksum: sha256(stableJson(payload)) };
}

function approvedManifestTransition() {
  const base = manifest();
  const next = structuredClone(base);
  next.sourceCommit = HEAD;
  for (let index = 0; index < 3; index += 1) {
    next.cases[index].sha256 = "9".repeat(64 - index) + String(index).repeat(index);
    next.cases[index].bytes += 50;
  }
  const { manifestChecksum: _old, ...payload } = next;
  next.manifestChecksum = sha256(stableJson(payload));
  return { base, next };
}

test("permits only approved case hashes, sizes, source, and checksum to change", () => {
  const { base, next } = approvedManifestTransition();
  assert.doesNotThrow(() => assertManifestTransition(base, next, LANDING_PATHS));
  for (const mutate of [
    (value) => { value.settings.maxDiffPixelRatio = 1; },
    (value) => { value.settings.locale = "pl-PL"; },
    (value) => { value.settings.reducedMotion = "no-preference"; },
    (value) => { value.runner.imageVersion = "drift"; },
    (value) => { value.cases[0].width = 391; },
    (value) => { value.cases[3].sha256 = "0".repeat(64); },
  ]) {
    const candidate = structuredClone(next);
    mutate(candidate);
    const { manifestChecksum: _checksum, ...payload } = candidate;
    candidate.manifestChecksum = sha256(stableJson(payload));
    assert.throws(
      () => assertManifestTransition(base, candidate, LANDING_PATHS),
      /intentional-redesign-manifest-drift/u,
    );
  }
});

test("binds the successful workflow run and both exact artifacts", () => {
  const record = approval();
  const run = {
    id: 123,
    event: "workflow_dispatch",
    head_sha: HEAD,
    status: "completed",
    conclusion: "success",
    run_attempt: 1,
    created_at: RUN_CREATED,
    updated_at: RUN_COMPLETED,
    path: ".github/workflows/phase5a0d-visual-baselines.yml",
  };
  const artifacts = [
    {
      id: 456,
      name: record.candidate.artifactName,
      expired: false,
      digest: record.candidate.archiveDigest,
      size_in_bytes: 1000,
    },
    {
      id: 457,
      name: record.candidate.determinismArtifactName,
      expired: false,
      digest: record.candidate.determinismArchiveDigest,
      size_in_bytes: 500,
    },
  ];
  assert.doesNotThrow(() => assertRunAndArtifacts(run, artifacts, record, COMMENT_CREATED));
  assert.throws(
    () => assertRunAndArtifacts({ ...run, conclusion: "failure" }, artifacts, record, COMMENT_CREATED),
    /candidate-run-conclusion-invalid/u,
  );
  assert.throws(
    () => assertRunAndArtifacts(run, [{ ...artifacts[0], digest: `sha256:${"0".repeat(64)}` }, artifacts[1]], record, COMMENT_CREATED),
    /candidate-artifact-invalid/u,
  );
});

test("keeps intentional-redesign acceptance base-owned, read-only, and externally authorized", () => {
  const target = readFileSync(
    new URL(".github/workflows/phase5a0d-intentional-redesign.yml", repositoryRoot),
    "utf8",
  );
  const visual = readFileSync(
    new URL(".github/workflows/phase5a0d-visual-baselines.yml", repositoryRoot),
    "utf8",
  );
  const policy = readFileSync(
    new URL(".github/scripts/phase5a0d-intentional-redesign.mjs", repositoryRoot),
    "utf8",
  );
  assert.match(target, /pull_request_target:/u);
  assert.match(target, /actions: read/u);
  assert.match(target, /contents: read/u);
  assert.match(target, /issues: read/u);
  assert.match(target, /pull-requests: read/u);
  assert.doesNotMatch(target, /contents: write|issues: write|pull-requests: write/u);
  assert.match(target, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/u);
  assert.doesNotMatch(target, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/u);
  assert.match(target, /git fetch --no-tags --no-write-fetch-head origin "\$HEAD_SHA"/u);
  assert.match(policy, /phase5a0d-intentional-redesign-approved/u);
  assert.match(target, /phase5a0d-intentional-redesign\.mjs extract-approval/u);
  assert.match(target, /phase5a0d-intentional-redesign\.mjs validate/u);
  assert.match(target, /phase5a0d-intentional-redesign\.test\.mjs/u);
  assert.match(target, /raise RuntimeError\(f"\{name\}-path-invalid"\)/u);
  assert.match(target, /raise RuntimeError\(f"\{name\}-archive-invalid"\)/u);
  assert.doesNotMatch(target, /git checkout .*HEAD_SHA|git switch|git commit|git push/u);
  assert.match(
    visual,
    /startsWith\(github\.event\.pull_request\.head\.ref, 'codex\/phase5a0d-accept-'\)/u,
  );
  assert.match(visual, /phase5a0d-intentional-redesign-approved/u);
  assert.match(visual, /codex\/phase5a0d-intentional-redesign-baseline-policy/u);
  assert.match(visual, /94a41d63204eaf3181c0507e9ea63fbc3b84a140/u);
});

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function writeManifest(root, value) {
  const target = path.join(root, ...MANIFEST_PATH.split("/"));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function writeCase(root, relativeFile, bytes) {
  const target = path.join(root, "frontend", "e2e", "__screenshots__", ...relativeFile.split("/"));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, bytes);
}

function integrationFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "tryvit-redesign-policy-"));
  git(root, ["init"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Policy Test"]);

  const baseManifest = manifest();
  const baseBytes = new Map();
  for (const entry of baseManifest.cases) {
    const bytes = Buffer.from(`base:${entry.id}`);
    entry.bytes = bytes.byteLength;
    entry.sha256 = sha256(bytes);
    baseBytes.set(entry.relativeFile, bytes);
    writeCase(root, entry.relativeFile, bytes);
  }
  const { manifestChecksum: _baseChecksum, ...basePayload } = baseManifest;
  baseManifest.manifestChecksum = sha256(stableJson(basePayload));
  writeManifest(root, baseManifest);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "base"]);
  const baseSha = git(root, ["rev-parse", "HEAD"]);
  const baseTree = git(root, ["rev-parse", "HEAD^{tree}"]);

  const nextManifest = structuredClone(baseManifest);
  nextManifest.sourceCommit = baseSha;
  for (let index = 0; index < nextManifest.cases.length; index += 1) {
    const entry = nextManifest.cases[index];
    const repositoryPath = `frontend/e2e/__screenshots__/${entry.relativeFile}`;
    const bytes = LANDING_PATHS.includes(repositoryPath)
      ? Buffer.from(`approved:${entry.id}`)
      : baseBytes.get(entry.relativeFile);
    entry.bytes = bytes.byteLength;
    entry.sha256 = sha256(bytes);
    writeCase(root, entry.relativeFile, bytes);
  }
  const { manifestChecksum: _nextChecksum, ...nextPayload } = nextManifest;
  nextManifest.manifestChecksum = sha256(stableJson(nextPayload));
  writeManifest(root, nextManifest);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "approved baselines"]);
  const headSha = git(root, ["rev-parse", "HEAD"]);

  const candidateRoot = path.join(root, "candidate");
  const determinismRoot = path.join(root, "determinism");
  mkdirSync(candidateRoot);
  mkdirSync(determinismRoot);
  const screenshotRoot = path.join(root, "frontend", "e2e", "__screenshots__");
  for (const entry of nextManifest.cases) {
    const source = path.join(screenshotRoot, ...entry.relativeFile.split("/"));
    const destination = path.join(candidateRoot, ...entry.relativeFile.split("/"));
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
  cpSync(path.join(screenshotRoot, "phase5a0d-manifest.json"), path.join(candidateRoot, "phase5a0d-manifest.json"));
  const candidateFiles = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else candidateFiles.push(path.relative(candidateRoot, absolute).replaceAll(path.sep, "/"));
    }
  };
  visit(candidateRoot);
  candidateFiles.sort();
  const ledger = `${candidateFiles.map((file) => `${sha256(readFileSync(path.join(candidateRoot, ...file.split("/"))))}  ./${file}`).join("\n")}\n`;
  const manifestBytes = readFileSync(path.join(candidateRoot, "phase5a0d-manifest.json"));
  writeFileSync(path.join(determinismRoot, "first-manifest.json"), manifestBytes);
  writeFileSync(path.join(determinismRoot, "second-manifest.json"), manifestBytes);
  writeFileSync(path.join(determinismRoot, "first-files.sha256"), ledger);
  writeFileSync(path.join(determinismRoot, "second-files.sha256"), ledger);
  writeFileSync(
    path.join(determinismRoot, "provenance.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      sourceCommit: baseSha,
      runner: nextManifest.runner,
      versions: nextManifest.versions,
      generatorArchiveSha256: "1".repeat(64),
      packageJsonSha256: "2".repeat(64),
      packageLockSha256: "3".repeat(64),
      byteIdentical: true,
    }, null, 2)}\n`,
  );

  const record = approval(headSha);
  record.approvedImplementation.headSha = baseSha;
  record.approvedImplementation.tree = baseTree;
  record.candidate.sourceCommit = baseSha;
  record.candidate.artifactName = `phase5a0d-visual-baseline-candidates-${baseSha}`;
  record.candidate.determinismArtifactName = `phase5a0d-visual-determinism-evidence-${baseSha}`;
  const external = {
    approval: record,
    external: {
      owner: OWNER,
      headRef: "codex/phase5a0d-accept-test",
      commentId: 100,
      commentCreatedAt: COMMENT_CREATED,
      commentUpdatedAt: COMMENT_CREATED,
      labelEventId: 200,
      labelCreatedAt: LABEL_CREATED,
    },
  };
  const approvalFile = path.join(root, "approval.json");
  const runFile = path.join(root, "run.json");
  const artifactsFile = path.join(root, "artifacts.json");
  writeFileSync(approvalFile, JSON.stringify(external));
  writeFileSync(runFile, JSON.stringify({
    id: 123,
    event: "workflow_dispatch",
    head_sha: baseSha,
    status: "completed",
    conclusion: "success",
    run_attempt: 1,
    created_at: RUN_CREATED,
    updated_at: RUN_COMPLETED,
    path: ".github/workflows/phase5a0d-visual-baselines.yml",
  }));
  writeFileSync(artifactsFile, JSON.stringify({ artifacts: [
    { id: 456, name: record.candidate.artifactName, expired: false, digest: record.candidate.archiveDigest, size_in_bytes: 1000 },
    { id: 457, name: record.candidate.determinismArtifactName, expired: false, digest: record.candidate.determinismArchiveDigest, size_in_bytes: 500 },
  ] }));

  return {
    root,
    options: {
      repositoryRoot: root,
      candidateRoot,
      determinismRoot,
      approvalFile,
      runFile,
      artifactsFile,
      baseSha,
      headSha,
    },
  };
}

test("accepts one exactly authorized intentional-redesign fixture", () => {
  const fixture = integrationFixture();
  try {
    const result = validateIntentionalRedesign(fixture.options);
    assert.deepEqual(result.authorizedPaths, [...LANDING_PATHS]);
    assert.equal(result.candidateRunId, 123);
  } finally {
    rmSync(fixture.root, { recursive: true, force: false });
  }
});

test("rejects product-source mutation and a nondeterministic candidate", () => {
  const sourceFixture = integrationFixture();
  try {
    writeFileSync(path.join(sourceFixture.root, "product-source.ts"), "changed");
    git(sourceFixture.root, ["add", "product-source.ts"]);
    git(sourceFixture.root, ["commit", "-m", "unapproved source"]);
    sourceFixture.options.headSha = git(sourceFixture.root, ["rev-parse", "HEAD"]);
    const external = JSON.parse(readFileSync(sourceFixture.options.approvalFile, "utf8"));
    external.approval.baselinePrHead = sourceFixture.options.headSha;
    writeFileSync(sourceFixture.options.approvalFile, JSON.stringify(external));
    assert.throws(
      () => validateIntentionalRedesign(sourceFixture.options),
      /baseline-change-status-invalid|intentional-redesign-scope-invalid/u,
    );
  } finally {
    rmSync(sourceFixture.root, { recursive: true, force: false });
  }

  const deterministicFixture = integrationFixture();
  try {
    writeFileSync(
      path.join(deterministicFixture.options.determinismRoot, "second-files.sha256"),
      `${"0".repeat(64)}  ./phase5a0d-manifest.json\n`,
    );
    assert.throws(
      () => validateIntentionalRedesign(deterministicFixture.options),
      /determinism-ledger-mismatch/u,
    );
  } finally {
    rmSync(deterministicFixture.root, { recursive: true, force: false });
  }
});

test("rejects an artifact symlink or reparse-point traversal", (context) => {
  const fixture = integrationFixture();
  const outside = mkdtempSync(path.join(tmpdir(), "tryvit-redesign-outside-"));
  const linkedDirectory = path.join(fixture.options.candidateRoot, "smoke-visual.spec.ts");
  try {
    cpSync(linkedDirectory, outside, { recursive: true });
    rmSync(linkedDirectory, { recursive: true, force: false });
    try {
      symlinkSync(
        outside,
        linkedDirectory,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if (error && ["EPERM", "EACCES"].includes(error.code)) {
        context.skip("symlink creation is unavailable on this host");
        return;
      }
      throw error;
    }
    assert.throws(
      () => validateIntentionalRedesign(fixture.options),
      /artifact-symlink-forbidden/u,
    );
  } finally {
    if (existsSync(linkedDirectory)) rmSync(linkedDirectory, { recursive: true, force: false });
    rmSync(fixture.root, { recursive: true, force: false });
    rmSync(outside, { recursive: true, force: false });
  }
});
