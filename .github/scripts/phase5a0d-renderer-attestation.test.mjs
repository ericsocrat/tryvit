import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ATTESTATION_PATH,
  MANIFEST_PATH,
  RENDERER_ATTESTATION_BRANCH,
  RENDERER_AUTHORIZATION_LABEL,
  SOURCE_EQUIVALENCE_APPROVAL_MARKER,
  assertChangedPaths,
  assertManifestTransition,
  selectRendererSourceEquivalenceApproval,
  validateRendererAttestation,
} from "./phase5a0d-renderer-attestation.mjs";

const repositoryRoot = new URL("../../", import.meta.url);
const targetWorkflow = readFileSync(
  new URL(".github/workflows/phase5a0d-renderer-attestation.yml", repositoryRoot),
  "utf8",
);

function scopeProgram() {
  const match = targetWorkflow.match(
    /# phase5a0d-renderer-attestation-scope:start\s+CHANGED_PATHS="\$changed" node <<'NODE'\r?\n([\s\S]*?)\r?\n\s+NODE\s+# phase5a0d-renderer-attestation-scope:end/u,
  );
  assert.ok(match, "renderer-attestation-scope-program-missing");
  const lines = match[1].split(/\r?\n/u);
  const indentation = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/u)[0].length),
  );
  return lines.map((line) => line.slice(indentation)).join("\n");
}

function classifyScope(changedPaths, labels = []) {
  const directory = mkdtempSync(path.join(tmpdir(), "phase5a0d-renderer-scope-"));
  const output = path.join(directory, "github-output.txt");
  try {
    execFileSync(process.execPath, ["-e", scopeProgram()], {
      env: {
        ...process.env,
        CHANGED_PATHS: changedPaths.join("\n"),
        LABELS_JSON: JSON.stringify(labels),
        GITHUB_OUTPUT: output,
      },
      stdio: "pipe",
    });
    return Object.fromEntries(
      readFileSync(output, "utf8")
        .trim()
        .split("\n")
        .map((line) => line.split("=")),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function manifest() {
  return JSON.parse(
    readFileSync(
      new URL("frontend/e2e/__screenshots__/phase5a0d-manifest.json", repositoryRoot),
      "utf8",
    ),
  );
}

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

function git(root, args, encoding = "utf8") {
  return execFileSync("git", ["-C", root, ...args], { encoding });
}

function write(root, relativePath, value) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function writeJson(root, relativePath, value) {
  write(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function commit(root, message) {
  git(root, ["add", "--all"]);
  git(root, ["commit", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]).trim();
}

function metadata(value, bytes) {
  return {
    manifestSha256: sha256(bytes),
    manifestChecksum: value.manifestChecksum,
    sourceCommit: value.sourceCommit,
    runnerImageVersion: value.runner.imageVersion,
    versions: structuredClone(value.versions),
  };
}

function buildSourceEquivalentFixture(mutate = {}) {
  const sandbox = mkdtempSync(path.join(tmpdir(), "phase5a0d-renderer-v2-"));
  const root = path.join(sandbox, "repository");
  const candidateRoot = path.join(sandbox, "candidate");
  const determinismRoot = path.join(sandbox, "determinism");
  mkdirSync(root);
  mkdirSync(candidateRoot);
  mkdirSync(determinismRoot);
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "fixture@example.invalid"]);
  git(root, ["config", "user.name", "Fixture"]);
  git(root, ["config", "core.autocrlf", "false"]);

  const baseManifest = manifest();
  writeJson(root, MANIFEST_PATH, baseManifest);
  writeJson(root, ATTESTATION_PATH, { historical: true });
  const pngs = baseManifest.cases
    .map((entry) => ({ file: entry.relativeFile, bytes: entry.bytes, sha256: entry.sha256 }))
    .sort((left, right) => left.file.localeCompare(right.file));
  for (const png of pngs) {
    const source = new URL(`frontend/e2e/__screenshots__/${png.file}`, repositoryRoot);
    const target = path.join(root, "frontend/e2e/__screenshots__", png.file);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
  for (const relativePath of [
    "frontend/src/app/page.tsx",
    "frontend/src/app/HomePageContent.tsx",
    "frontend/src/proxy.ts",
    "frontend/src/app/_landing-v2/copy.ts",
  ]) {
    write(root, relativePath, "base-runtime\n");
  }
  writeJson(root, "frontend/package.json", { name: "fixture", private: true });
  writeJson(root, "frontend/package-lock.json", { lockfileVersion: 3, packages: {} });
  const baseSha = commit(root, "base");

  git(root, ["switch", "-c", "candidate"]);
  for (const relativePath of [
    "frontend/src/app/page.tsx",
    "frontend/src/app/HomePageContent.tsx",
    "frontend/src/proxy.ts",
    "frontend/src/app/_landing-v2/copy.ts",
  ]) {
    write(root, relativePath, "approved-runtime\n");
  }
  const candidateSourceSha = commit(root, "candidate source");
  const candidateSourceTree = git(root, ["rev-parse", "HEAD^{tree}"]).trim();
  if (mutate.synchronizedRuntime) {
    write(root, "frontend/src/app/_landing-v2/copy.ts", "drifted-runtime\n");
  } else {
    write(root, "docs/synchronized.txt", "metadata only\n");
  }
  const synchronizedSha = commit(root, "synchronized implementation");
  const synchronizedTree = git(root, ["rev-parse", "HEAD^{tree}"]).trim();
  git(root, ["switch", "main"]);

  const nextManifest = structuredClone(baseManifest);
  nextManifest.sourceCommit = candidateSourceSha;
  nextManifest.runner.imageVersion = `${baseManifest.runner.imageVersion}-fixture-next`;
  mutate.nextManifest?.(nextManifest);
  const { manifestChecksum: _discarded, ...payload } = nextManifest;
  nextManifest.manifestChecksum = sha256(stableJson(payload));
  const candidateManifestBytes = Buffer.from(`${JSON.stringify(nextManifest, null, 2)}\n`);
  writeFileSync(path.join(candidateRoot, "phase5a0d-manifest.json"), candidateManifestBytes);
  for (const png of pngs) {
    const source = path.join(root, "frontend/e2e/__screenshots__", png.file);
    const target = path.join(candidateRoot, png.file);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
  }

  const ledger =
    ["phase5a0d-manifest.json", ...pngs.map(({ file }) => file)]
      .sort()
      .map((file) => `${sha256(readFileSync(path.join(candidateRoot, file)))}  ./${file}`)
      .join("\n") + "\n";
  writeFileSync(path.join(determinismRoot, "first-manifest.json"), candidateManifestBytes);
  writeFileSync(path.join(determinismRoot, "second-manifest.json"), candidateManifestBytes);
  writeFileSync(path.join(determinismRoot, "first-files.sha256"), ledger);
  writeFileSync(path.join(determinismRoot, "second-files.sha256"), ledger);
  const packageBytes = git(root, ["show", `${candidateSourceSha}:frontend/package.json`], null);
  const lockBytes = git(root, ["show", `${candidateSourceSha}:frontend/package-lock.json`], null);
  writeJson(determinismRoot, "provenance.json", {
    schemaVersion: 1,
    sourceCommit: candidateSourceSha,
    runner: nextManifest.runner,
    versions: nextManifest.versions,
    generatorArchiveSha256: "a".repeat(64),
    packageJsonSha256: sha256(packageBytes),
    packageLockSha256: sha256(lockBytes),
    byteIdentical: true,
  });

  const record = {
    workflowRunId: 12345,
    workflowRunAttempt: 1,
    runCreatedAt: "2026-08-26T10:00:00Z",
    runCompletedAt: "2026-08-26T10:10:00Z",
    artifactId: 22222,
    artifactName: `phase5a0d-visual-baseline-candidates-${candidateSourceSha}`,
    archiveDigest: `sha256:${"b".repeat(64)}`,
    archiveBytes: 600000,
    determinismArtifactId: 33333,
    determinismArtifactName: `phase5a0d-visual-determinism-evidence-${candidateSourceSha}`,
    determinismArchiveDigest: `sha256:${"c".repeat(64)}`,
    determinismArchiveBytes: 4000,
    sourceCommit: candidateSourceSha,
  };
  const baseManifestBytes = Buffer.from(`${JSON.stringify(baseManifest, null, 2)}\n`);
  const evidence = {
    schemaVersion: 2,
    attestationType: "phase5a0d-renderer-runtime-source-equivalence",
    baseCommit: baseSha,
    candidateSource: { headSha: candidateSourceSha, tree: candidateSourceTree },
    synchronizedImplementation: {
      prNumber: 1301,
      headSha: synchronizedSha,
      tree: synchronizedTree,
    },
    candidate: record,
    oldManifest: metadata(baseManifest, baseManifestBytes),
    newManifest: metadata(nextManifest, candidateManifestBytes),
    review: { result: "approved-byte-identical", caseCount: 7, pngs },
  };
  mutate.evidence?.(evidence);
  writeFileSync(path.join(root, MANIFEST_PATH), candidateManifestBytes);
  writeJson(root, ATTESTATION_PATH, evidence);
  if (mutate.headProduct) write(root, "frontend/src/app/extra.ts", "forbidden\n");
  if (mutate.headPng) write(root, `frontend/e2e/__screenshots__/${pngs[0].file}`, "drift\n");
  const headSha = commit(root, "metadata attestation");

  const approval = {
    approval: {
      schemaVersion: 2,
      approvalType: "phase5a0d-renderer-source-equivalence",
      attestationPrHead: headSha,
    },
    external: {
      owner: "owner",
      headRef: RENDERER_ATTESTATION_BRANCH,
      commentId: 10,
      commentCreatedAt: "2026-08-26T11:00:00Z",
      commentUpdatedAt: "2026-08-26T11:00:00Z",
      labelEventId: 11,
      labelCreatedAt: "2026-08-26T11:01:00Z",
    },
  };
  mutate.approval?.(approval);
  const approvalFile = path.join(root, "approval.json");
  writeJson(root, "approval.json", approval);
  const run = {
    id: record.workflowRunId,
    event: "workflow_dispatch",
    head_sha: candidateSourceSha,
    status: "completed",
    conclusion: "success",
    run_attempt: 1,
    created_at: record.runCreatedAt,
    updated_at: record.runCompletedAt,
    path: ".github/workflows/phase5a0d-visual-baselines.yml",
  };
  mutate.run?.(run);
  const runFile = path.join(root, "run.json");
  writeJson(root, "run.json", run);
  const artifacts = {
    artifacts: [
      {
        id: record.artifactId,
        name: record.artifactName,
        expired: false,
        digest: record.archiveDigest,
        size_in_bytes: record.archiveBytes,
      },
      {
        id: record.determinismArtifactId,
        name: record.determinismArtifactName,
        expired: false,
        digest: record.determinismArchiveDigest,
        size_in_bytes: record.determinismArchiveBytes,
      },
    ],
  };
  mutate.artifacts?.(artifacts);
  const artifactsFile = path.join(root, "artifacts.json");
  writeJson(root, "artifacts.json", artifacts);
  mutate.candidate?.({ candidateRoot, determinismRoot, pngs });

  return {
    sandbox,
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
      runId: record.workflowRunId,
      runAttempt: record.workflowRunAttempt,
      runCreatedAt: record.runCreatedAt,
      runCompletedAt: record.runCompletedAt,
      artifactId: record.artifactId,
      artifactName: record.artifactName,
      archiveDigest: record.archiveDigest.replace(/^sha256:/u, ""),
      archiveBytes: record.archiveBytes,
      determinismArtifactId: record.determinismArtifactId,
      determinismArtifactName: record.determinismArtifactName,
      determinismArchiveDigest: record.determinismArchiveDigest.replace(/^sha256:/u, ""),
      determinismArchiveBytes: record.determinismArchiveBytes,
    },
  };
}

function withFixture(mutate, callback) {
  const fixture = buildSourceEquivalentFixture(mutate);
  try {
    return callback(fixture);
  } finally {
    rmSync(fixture.sandbox, { recursive: true, force: true });
  }
}

function reviewedTransition() {
  const candidate = structuredClone(manifest());
  candidate.sourceCommit = "1".repeat(40);
  candidate.runner.imageVersion = "20991231.999.1";
  candidate.versions.playwright = "99.0.0";
  candidate.manifestChecksum = "2".repeat(64);
  return candidate;
}

test("accepts only the exact metadata-only refresh paths", () => {
  assert.doesNotThrow(() => assertChangedPaths([MANIFEST_PATH, ATTESTATION_PATH]));
  assert.throws(
    () => assertChangedPaths([MANIFEST_PATH, ATTESTATION_PATH, "frontend/src/app/page.tsx"]),
    /renderer-attestation-scope-invalid/u,
  );
  assert.throws(
    () =>
      assertChangedPaths([MANIFEST_PATH, "frontend/e2e/__screenshots__/p5a0d-landing-mobile.png"]),
    /renderer-attestation-scope-invalid/u,
  );
});

test("permits only source and observed runner/runtime metadata", () => {
  assert.doesNotThrow(() => assertManifestTransition(manifest(), reviewedTransition()));

  for (const mutate of [
    (candidate) => candidate.cases.reverse(),
    (candidate) => {
      candidate.cases[0].width += 1;
    },
    (candidate) => {
      candidate.cases[0].sha256 = "3".repeat(64);
    },
    (candidate) => {
      candidate.cases[0].bytes += 1;
    },
    (candidate) => {
      candidate.settings.locale = "pl-PL";
    },
    (candidate) => {
      candidate.settings.maxDiffPixelRatio = 1;
    },
    (candidate) => {
      candidate.fixtureContractChecksum = "4".repeat(64);
    },
    (candidate) => {
      candidate.kind = "replacement-baseline";
    },
  ]) {
    const candidate = reviewedTransition();
    mutate(candidate);
    assert.throws(
      () => assertManifestTransition(manifest(), candidate),
      /renderer-attestation-manifest-drift/u,
    );
  }
});

test("rejects a refresh with no observed runner/runtime drift", () => {
  const candidate = reviewedTransition();
  candidate.runner = structuredClone(manifest().runner);
  candidate.versions = structuredClone(manifest().versions);
  assert.throws(
    () => assertManifestTransition(manifest(), candidate),
    /renderer-attestation-no-runtime-drift/u,
  );
});

test("selects only a fresh owner authorization bound to the exact metadata head", () => {
  const headSha = "1".repeat(40);
  const body = `<!-- ${SOURCE_EQUIVALENCE_APPROVAL_MARKER}\n${JSON.stringify({
    schemaVersion: 2,
    approvalType: "phase5a0d-renderer-source-equivalence",
    attestationPrHead: headSha,
  })}\n-->`;
  const input = {
    comments: [
      {
        id: 10,
        user: { login: "owner" },
        author_association: "OWNER",
        body,
        created_at: "2026-08-26T11:00:00Z",
        updated_at: "2026-08-26T11:00:00Z",
      },
    ],
    events: [
      {
        id: 11,
        event: "labeled",
        label: { name: RENDERER_AUTHORIZATION_LABEL },
        actor: { login: "owner" },
        created_at: "2026-08-26T11:01:00Z",
      },
    ],
    owner: "owner",
    headSha,
    headRef: RENDERER_ATTESTATION_BRANCH,
    labels: [RENDERER_AUTHORIZATION_LABEL],
  };
  assert.equal(selectRendererSourceEquivalenceApproval(input).approval.attestationPrHead, headSha);
  assert.throws(
    () => selectRendererSourceEquivalenceApproval({ ...input, labels: [] }),
    /renderer-approval-label-missing/u,
  );
  assert.throws(
    () =>
      selectRendererSourceEquivalenceApproval({
        ...input,
        headSha: "2".repeat(40),
      }),
    /renderer-approval-owner-comment-missing/u,
  );
  assert.throws(
    () =>
      selectRendererSourceEquivalenceApproval({
        ...input,
        events: [{ ...input.events[0], created_at: "2026-08-26T10:59:00Z" }],
      }),
    /renderer-approval-label-predates-comment/u,
  );
});

test("accepts one exact source-equivalent renderer attestation", () => {
  withFixture({}, ({ options }) => {
    const result = validateRendererAttestation(options);
    assert.equal(result.mode, "source-equivalence");
    assert.equal(result.caseCount, 7);
  });
});

test("rejects wrong source identity and non-equivalent landing runtime", () => {
  withFixture(
    {
      evidence: (evidence) => {
        evidence.candidateSource.tree = "f".repeat(40);
      },
    },
    ({ options }) => {
      assert.throws(
        () => validateRendererAttestation(options),
        /attestation-candidate-source-tree-mismatch/u,
      );
    },
  );
  withFixture({ synchronizedRuntime: true }, ({ options }) => {
    assert.throws(() => validateRendererAttestation(options), /renderer-landing-source-drift/u);
  });
});

test("rejects candidate pixel drift and nondeterministic evidence", () => {
  withFixture(
    {
      candidate: ({ candidateRoot, pngs }) => {
        writeFileSync(path.join(candidateRoot, pngs[0].file), "pixel-drift\n");
      },
    },
    ({ options }) => {
      const started = performance.now();
      assert.throws(() => validateRendererAttestation(options), /candidate-png-changed/u);
      assert.equal(performance.now() - started < 5_000, true, "png-drift-check-unbounded");
    },
  );
  withFixture(
    {
      candidate: ({ determinismRoot }) => {
        writeFileSync(
          path.join(determinismRoot, "second-files.sha256"),
          `${"0".repeat(64)}  ./wrong\n`,
        );
      },
    },
    ({ options }) => {
      assert.throws(() => validateRendererAttestation(options), /determinism-ledger-drift/u);
    },
  );
});

test("rejects expired, wrong-digest, and wrong-size artifacts", () => {
  for (const mutate of [
    (artifacts) => {
      artifacts.artifacts[0].expired = true;
    },
    (artifacts) => {
      artifacts.artifacts[0].digest = `sha256:${"d".repeat(64)}`;
    },
    (artifacts) => {
      artifacts.artifacts[1].size_in_bytes += 1;
    },
  ]) {
    withFixture({ artifacts: mutate }, ({ options }) => {
      assert.throws(
        () => validateRendererAttestation(options),
        /candidate-artifact-binding-invalid/u,
      );
    });
  }
});

test("rejects runner, settings, product, and committed PNG drift", () => {
  withFixture(
    {
      candidate: ({ determinismRoot }) => {
        const file = path.join(determinismRoot, "provenance.json");
        const provenance = JSON.parse(readFileSync(file, "utf8"));
        provenance.runner.imageVersion = "wrong";
        writeFileSync(file, `${JSON.stringify(provenance, null, 2)}\n`);
      },
    },
    ({ options }) => {
      assert.throws(() => validateRendererAttestation(options), /determinism-runner-invalid/u);
    },
  );
  withFixture(
    {
      nextManifest: (next) => {
        next.settings.locale = "pl-PL";
      },
    },
    ({ options }) => {
      assert.throws(
        () => validateRendererAttestation(options),
        /renderer-attestation-manifest-drift/u,
      );
    },
  );
  withFixture({ headProduct: true }, ({ options }) => {
    assert.throws(
      () => validateRendererAttestation(options),
      /renderer-attestation-scope-invalid/u,
    );
  });
  withFixture({ headPng: true }, ({ options }) => {
    assert.throws(
      () => validateRendererAttestation(options),
      /renderer-attestation-scope-invalid/u,
    );
  });
});

test("rejects extra files and symlink input", () => {
  withFixture(
    {
      candidate: ({ determinismRoot }) =>
        writeFileSync(path.join(determinismRoot, "extra.txt"), "extra"),
    },
    ({ options }) => {
      assert.throws(() => validateRendererAttestation(options), /determinism-file-set-invalid/u);
    },
  );
  if (process.platform !== "win32") {
    withFixture(
      {
        candidate: ({ determinismRoot }) => {
          symlinkSync("first-manifest.json", path.join(determinismRoot, "linked.json"));
        },
      },
      ({ options }) => {
        assert.throws(() => validateRendererAttestation(options), /candidate-symlink-forbidden/u);
      },
    );
  }
});

test("delegates only an authorized baseline-only redesign", () => {
  const baselinePaths = [
    MANIFEST_PATH,
    "frontend/e2e/__screenshots__/smoke-visual.spec.ts/p5a0d-landing-390x844-light-reduced.png",
  ];
  assert.deepEqual(classifyScope(baselinePaths, ["phase5a0d-intentional-redesign-approved"]), {
    required: "false",
    delegated: "true",
    reason: "intentional-redesign-validator",
  });
  assert.deepEqual(classifyScope(baselinePaths), {
    required: "true",
    delegated: "false",
    reason: "renderer-attestation-required",
  });
});

test("fails closed when intentional authorization is removed or scope is mixed", () => {
  const label = ["phase5a0d-intentional-redesign-approved"];
  const baseline =
    "frontend/e2e/__screenshots__/smoke-visual.spec.ts/p5a0d-landing-390x844-light-reduced.png";
  for (const changedPaths of [
    [baseline, ATTESTATION_PATH],
    [baseline, "frontend/src/app/page.tsx"],
    [baseline, ".github/workflows/phase5a0d-renderer-attestation.yml"],
  ]) {
    assert.deepEqual(classifyScope(changedPaths, label), {
      required: "true",
      delegated: "false",
      reason: "renderer-attestation-required",
    });
  }
});

test("keeps renderer evidence strict and ordinary product changes unaffected", () => {
  assert.deepEqual(classifyScope([ATTESTATION_PATH]), {
    required: "true",
    delegated: "false",
    reason: "renderer-attestation-required",
  });
  assert.deepEqual(classifyScope(["frontend/src/app/page.tsx"]), {
    required: "false",
    delegated: "false",
    reason: "not-applicable",
  });
});

test("policy workflows keep target validation base-owned and read-only", () => {
  const target = targetWorkflow;
  const visual = readFileSync(
    new URL(".github/workflows/phase5a0d-visual-baselines.yml", repositoryRoot),
    "utf8",
  );
  const normalizedVisual = visual.replace(/\r\n/gu, "\n");

  assert.match(target, /pull_request_target:/u);
  assert.match(target, /actions: read/u);
  assert.match(target, /contents: read/u);
  assert.match(target, /issues: read/u);
  assert.match(target, /pull-requests: read/u);
  assert.doesNotMatch(target, /pull-requests: write|contents: write/u);
  assert.match(target, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/u);
  assert.match(target, /git show "\$HEAD_SHA:/u);
  assert.doesNotMatch(target, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/u);
  assert.match(target, /phase5a0d-renderer-attestation-approved/u);
  assert.match(target, /phase5a0d-renderer-attestation\.mjs extract-approval/u);
  assert.match(target, /phase5a0d-renderer-determinism/u);
  assert.match(target, /APPROVAL_MODE.*source-equivalence/su);
  assert.match(target, /phase5a0d-intentional-redesign-approved/u);
  assert.match(target, /intentional-redesign-validator/u);
  assert.match(target, /baselineOnly/u);
  assert.match(target, /node "\$RUNNER_TEMP\/phase5a0d-renderer-attestation\.mjs"/u);
  assert.match(
    visual,
    /pull_request:\s+types: \[opened, synchronize, reopened, labeled, unlabeled\]/u,
  );
  assert.match(visual, /renderer-attestation-review-required/u);
  assert.match(visual, /renderer-attestation-scope-invalid/u);
  assert.match(visual, /codex\/phase-5a0d-renderer-attestation-shell-fix/u);
  assert.match(visual, /3887b1dc8eda1a59ce25725bf04996749f98935e/u);
  assert.match(visual, /codex\/phase-5a0d-attestation-label-trigger/u);
  assert.match(visual, /920d9d01fdff3ab88eb46c082114f5fca998834c/u);
  assert.match(visual, /codex\/phase-5a0d-renderer-identity-diagnostics/u);
  assert.match(visual, /d071d00970a108a13ab91aa7e1e736ca2416e119/u);
  assert.match(visual, /codex\/phase-5a0d-attested-manifest-restore/u);
  assert.match(visual, /d9257be564c5097ef473b153202fc8e92c5a70e1/u);
  assert.match(visual, /codex\/phase-5a0d-attestation-flag/u);
  assert.match(visual, /bb70102aa16b4aedf9a968c6c535dc99a3517b1d/u);
  assert.match(visual, /codex\/phase5a0d-host-runner-observation/u);
  assert.match(visual, /9c1bab1b4eac28d2cfe24a7cea1f0759fac1eafd/u);
  assert.match(visual, /frontend\/tooling\/phase5a0d-visual-baselines\.ts/u);
  assert.match(visual, /\.github\/scripts\/phase5a0d-renderer-attestation\.test\.mjs/u);
  assert.match(
    normalizedVisual,
    /printf '%s\\n' \\\n\s+'docs\/evidence\/phase5a0d-renderer-runtime-attestation\.json' \\\n\s+'frontend\/e2e\/__screenshots__\/phase5a0d-manifest\.json' \\\n\s+> "\$expected"/u,
  );
  assert.doesNotMatch(normalizedVisual, /phase5a0d-attestation-expected\.txt[\s\S]*?<<['"]?EOF/u);
  assert.match(visual, /Committed Phase 5A\.0d baselines are immutable relative/u);
  assert.match(
    normalizedVisual,
    /renderer_attestation=false[\s\S]*?base_manifest_blob="\$\(git rev-parse[\s\S]*?head_manifest_blob="\$\(git rev-parse[\s\S]*?\[ "\$base_manifest_blob" != "\$head_manifest_blob" \][\s\S]*?renderer_attestation=true[\s\S]*?echo "renderer_attestation=\$renderer_attestation" >> "\$GITHUB_OUTPUT"/u,
  );
  assert.match(
    normalizedVisual,
    /outputs\.renderer_attestation \}\}" = "true" \]; then[\s\S]*?git show "\$\{\{ github\.event\.pull_request\.head\.sha \}\}:frontend\/e2e\/__screenshots__\/phase5a0d-manifest\.json"[\s\S]*?rm -rf -- frontend\/e2e frontend\/tooling frontend\/playwright\.config\.ts[\s\S]*?tar -xf "\$RUNNER_TEMP\/phase5a0d-reviewed-visual-verifier\.tar"[\s\S]*?outputs\.renderer_attestation \}\}" = "true" \]; then[\s\S]*?cp -- "\$RUNNER_TEMP\/phase5a0d-attested-head-manifest\.json"[\s\S]*?frontend\/e2e\/__screenshots__\/phase5a0d-manifest\.json/u,
  );
  assert.equal(
    normalizedVisual.match(/echo "renderer_attestation=\$renderer_attestation"/gu)?.length,
    1,
  );
  assert.doesNotMatch(visual, /--update-snapshots|git commit|git push/u);
});
