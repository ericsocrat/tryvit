import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { classifyChanges, evaluateChecks, isBaselineOnly, mergeTrustedRisk, requiredChecks, trustedBaseRisk } from './change-risk.mjs';

test('docs-only changes retain core checks without expensive lanes', () => {
  const risk = classifyChanges(['docs/architecture.md']);
  assert.ok(Object.values(risk).every((value) => value === false));
  assert.ok(requiredChecks(risk).includes('Unit Tests'));
});
test('scoring/database, dependency, visual and browser changes select their lanes', () => {
  assert.equal(classifyChanges(['pipeline/scoring.py']).database, true);
  assert.equal(classifyChanges(['pipeline/scoring.py']).scoring, true);
  assert.equal(classifyChanges(['frontend/package-lock.json']).dependencies, true);
  assert.equal(classifyChanges(['frontend/src/theme.css']).browserSensitive, true);
  assert.equal(classifyChanges(['frontend/src/theme.css']).visual, true);
});
test('classifier/workflow changes cannot classify themselves out of checks', () => {
  assert.ok(Object.values(classifyChanges(['scripts/ci/change-risk.mjs'])).every(Boolean));
  assert.ok(Object.values(classifyChanges(['.github/workflows/pr-gate.yml'])).every(Boolean));
});
test('trusted base applicability cannot be reduced by the candidate classifier', () => {
  const low = classifyChanges(['docs/a.md']);
  const high = classifyChanges(['scripts/ci/change-risk.mjs']);
  assert.ok(Object.values(mergeTrustedRisk(low, high)).every(Boolean));
  assert.throws(() => mergeTrustedRisk(low, {}));
});
test('trusted base classifier executes its complete base-owned module closure', () => {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const reads = [];
  const risk = trustedBaseRisk(head, head, (file) => { reads.push(file); return readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'); });
  assert.ok(Object.values(risk).every((value) => value === false));
  assert.deepEqual(reads, ['scripts/ci/change-risk.mjs', 'scripts/ci/risk-workflows.mjs']);
  assert.throws(() => trustedBaseRisk(head, head, (file) => {
    if (file.endsWith('risk-workflows.mjs')) throw new Error('missing-base-dependency');
    return readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
  }), /missing-base-dependency/u);
});
test('rejects malformed paths instead of accepting a low-risk default', () => {
  for (const file of ['', '../secret', '/tmp/file', 'src\\file']) assert.throws(() => classifyChanges([file]));
});
test('unknown executable/config surfaces fail closed into full risk coverage', () => {
  assert.ok(Object.values(classifyChanges(['scripts/new-importer.mjs'])).every(Boolean));
  assert.equal(classifyChanges(['frontend/tooling/new-policy.mts']).visual, true);
});
test('baseline-only replacement requires independent intentional acceptance, not a skipped comparator', () => {
  const files = ['frontend/e2e/__screenshots__/phase5a0d-manifest.json', 'frontend/e2e/__screenshots__/p5a0d-landing.png'];
  assert.equal(isBaselineOnly(files), true);
  assert.equal(isBaselineOnly([...files, 'frontend/src/app/page.tsx']), false);
  assert.equal(isBaselineOnly([]), false);
  const required = requiredChecks(classifyChanges(files), isBaselineOnly(files));
  assert.ok(required.includes('Validate intentional baseline acceptance'));
  assert.ok(required.includes('Verify renderer/runtime attestation'));
  assert.ok(!required.includes('Verify immutable visual baselines'));
});
const sha = 'a'.repeat(40);
const run = { name: 'Unit Tests', id: 1, head_sha: sha, check_suite: { id: 1 }, app: { slug: 'github-actions' }, status: 'completed', conclusion: 'success' };
const metadata = { workflows: [{ id: 1, path: '.github/workflows/pr-gate.yml' }], workflowRuns: [{ id: 1, workflow_id: 1, path: '.github/workflows/pr-gate.yml', head_sha: sha, event: 'pull_request', run_number: 1, run_attempt: 1, check_suite_id: 1, status: 'completed' }], jobs: [{ id: 1, name: 'Unit Tests', head_sha: sha, run_id: 1, run_attempt: 1, status: 'completed', conclusion: 'success' }] };
const evaluate = (checks) => evaluateChecks(['Unit Tests'], checks, sha, metadata);
test('rollup requires successful exact-head checks from GitHub Actions', () => {
  assert.equal(evaluate([run]).pass, true);
  for (const conclusion of ['failure', 'cancelled', 'skipped', 'timed_out', 'neutral', 'action_required']) {
    assert.equal(evaluate([{ ...run, conclusion }]).pass, false);
  }
  assert.equal(evaluate([{ ...run, head_sha: 'b'.repeat(40) }]).pass, false);
  assert.equal(evaluate([{ ...run, app: { slug: 'other' } }]).pass, false);
  assert.equal(evaluate([]).pass, false);
});
test('a success from an unverified second suite does not mask the trusted failure', () => {
  assert.equal(evaluate([{ ...run, conclusion: 'failure' }, { ...run, id: 2, check_suite: { id: 2 } }]).pass, false);
});
