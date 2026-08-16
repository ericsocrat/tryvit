import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ATTESTATION_PATH,
  MANIFEST_PATH,
  assertChangedPaths,
  assertManifestTransition,
} from "./phase5a0d-renderer-attestation.mjs";

const repositoryRoot = new URL("../../", import.meta.url);

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

test("policy workflows keep target validation base-owned and read-only", () => {
  const target = readFileSync(
    new URL(".github/workflows/phase5a0d-renderer-attestation.yml", repositoryRoot),
    "utf8",
  );
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
  assert.match(visual, /\.github\/scripts\/phase5a0d-renderer-attestation\.test\.mjs/u);
  assert.equal(
    normalizedVisual.includes(
      `printf '%s\\n' \\
                  'docs/evidence/phase5a0d-renderer-runtime-attestation.json' \\
                  'frontend/e2e/__screenshots__/phase5a0d-manifest.json' \\
                  > "$expected"`,
    ),
    true,
  );
  assert.doesNotMatch(
    normalizedVisual,
    /phase5a0d-attestation-expected\.txt[\s\S]*?<<['"]?EOF/u,
  );
  assert.match(visual, /Committed Phase 5A\.0d baselines are immutable relative/u);
  assert.match(
    normalizedVisual,
    /renderer-attestation-review-required" \]; then[\s\S]*?git show "\$\{\{ github\.event\.pull_request\.head\.sha \}\}:frontend\/e2e\/__screenshots__\/phase5a0d-manifest\.json"[\s\S]*?rm -rf -- frontend\/e2e frontend\/tooling frontend\/playwright\.config\.ts[\s\S]*?tar -xf "\$RUNNER_TEMP\/phase5a0d-reviewed-visual-verifier\.tar"[\s\S]*?renderer-attestation-review-required" \]; then[\s\S]*?cp -- "\$RUNNER_TEMP\/phase5a0d-attested-head-manifest\.json"[\s\S]*?frontend\/e2e\/__screenshots__\/phase5a0d-manifest\.json/u,
  );
  assert.doesNotMatch(visual, /--update-snapshots|git commit|git push/u);
});
