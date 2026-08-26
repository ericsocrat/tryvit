import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ATTESTATION_PATH,
  MANIFEST_PATH,
  assertChangedPaths,
  assertManifestTransition,
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
    readFileSync(new URL("frontend/e2e/__screenshots__/phase5a0d-manifest.json", repositoryRoot), "utf8"),
  );
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
    () => assertChangedPaths([MANIFEST_PATH, "frontend/e2e/__screenshots__/p5a0d-landing-mobile.png"]),
    /renderer-attestation-scope-invalid/u,
  );
});

test("permits only source and observed runner/runtime metadata", () => {
  assert.doesNotThrow(() => assertManifestTransition(manifest(), reviewedTransition()));

  for (const mutate of [
    (candidate) => candidate.cases.reverse(),
    (candidate) => { candidate.cases[0].width += 1; },
    (candidate) => { candidate.cases[0].sha256 = "3".repeat(64); },
    (candidate) => { candidate.cases[0].bytes += 1; },
    (candidate) => { candidate.settings.locale = "pl-PL"; },
    (candidate) => { candidate.settings.maxDiffPixelRatio = 1; },
    (candidate) => { candidate.fixtureContractChecksum = "4".repeat(64); },
    (candidate) => { candidate.kind = "replacement-baseline"; },
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

test("delegates only an authorized baseline-only redesign", () => {
  const baselinePaths = [
    MANIFEST_PATH,
    "frontend/e2e/__screenshots__/smoke-visual.spec.ts/p5a0d-landing-390x844-light-reduced.png",
  ];
  assert.deepEqual(
    classifyScope(baselinePaths, ["phase5a0d-intentional-redesign-approved"]),
    {
      required: "false",
      delegated: "true",
      reason: "intentional-redesign-validator",
    },
  );
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
  assert.match(target, /pull-requests: read/u);
  assert.doesNotMatch(target, /pull-requests: write|contents: write/u);
  assert.match(target, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/u);
  assert.match(target, /git show "\$HEAD_SHA:/u);
  assert.doesNotMatch(target, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/u);
  assert.match(target, /phase5a0d-renderer-attestation-approved/u);
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
  assert.match(visual, /\.github\/scripts\/phase5a0d-renderer-attestation\.test\.mjs/u);
  assert.match(
    normalizedVisual,
    /printf '%s\\n' \\\n\s+'docs\/evidence\/phase5a0d-renderer-runtime-attestation\.json' \\\n\s+'frontend\/e2e\/__screenshots__\/phase5a0d-manifest\.json' \\\n\s+> "\$expected"/u,
  );
  assert.doesNotMatch(
    normalizedVisual,
    /phase5a0d-attestation-expected\.txt[\s\S]*?<<['"]?EOF/u,
  );
  assert.match(visual, /Committed Phase 5A\.0d baselines are immutable relative/u);
  assert.match(
    normalizedVisual,
    /renderer_attestation=false[\s\S]*?base_manifest_blob="\$\(git rev-parse[\s\S]*?head_manifest_blob="\$\(git rev-parse[\s\S]*?\[ "\$base_manifest_blob" != "\$head_manifest_blob" \][\s\S]*?renderer_attestation=true[\s\S]*?echo "renderer_attestation=\$renderer_attestation" >> "\$GITHUB_OUTPUT"/u,
  );
  assert.match(
    normalizedVisual,
    /outputs\.renderer_attestation \}\}" = "true" \]; then[\s\S]*?git show "\$\{\{ github\.event\.pull_request\.head\.sha \}\}:frontend\/e2e\/__screenshots__\/phase5a0d-manifest\.json"[\s\S]*?rm -rf -- frontend\/e2e frontend\/tooling frontend\/playwright\.config\.ts[\s\S]*?tar -xf "\$RUNNER_TEMP\/phase5a0d-reviewed-visual-verifier\.tar"[\s\S]*?outputs\.renderer_attestation \}\}" = "true" \]; then[\s\S]*?cp -- "\$RUNNER_TEMP\/phase5a0d-attested-head-manifest\.json"[\s\S]*?frontend\/e2e\/__screenshots__\/phase5a0d-manifest\.json/u,
  );
  assert.equal(normalizedVisual.match(/echo "renderer_attestation=\$renderer_attestation"/gu)?.length, 1);
  assert.doesNotMatch(visual, /--update-snapshots|git commit|git push/u);
});
