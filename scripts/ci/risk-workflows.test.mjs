import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateChecks } from './change-risk.mjs';
import { collectWorkflowEvidence } from './risk-workflows.mjs';
const head = 'a'.repeat(40);
const name = 'Validate intentional baseline acceptance';
const workflow = { id: 342834312, path: '.github/workflows/phase5a0d-intentional-redesign.yml' };
const execution = (id, number, suite, extra = {}) => ({ id, run_number: number, check_suite_id: suite, run_attempt: 1, workflow_id: workflow.id, path: workflow.path, head_sha: head, event: 'pull_request_target', status: 'completed', conclusion: 'success', ...extra });
const old = execution(34233742127, 240, 1);
const fresh = execution(34234164813, 241, 2);
const check = (id, suite, conclusion = 'success') => ({ id, name, head_sha: head, check_suite: { id: suite }, app: { slug: 'github-actions' }, status: 'completed', conclusion });
const job = (id, run = fresh) => ({ id, name, head_sha: head, run_id: run.id, run_attempt: run.run_attempt, status: 'completed', conclusion: 'success' });
const evidence = (runs = [old, fresh], jobs = [job(2)]) => ({ workflows: [workflow], workflowRuns: runs, jobs });
test('regression: successful labeled execution supersedes failed synchronize suite in the same trusted workflow', () => {
  assert.equal(evaluateChecks([name], [check(1, 1, 'failure'), check(2, 2)], head, evidence()).pass, true);
});
test('newer failure and queued execution cannot reuse earlier success', () => {
  assert.equal(evaluateChecks([name], [check(1, 1), check(2, 2, 'failure')], head, evidence()).pass, false);
  assert.equal(evaluateChecks([name], [check(1, 1)], head, evidence([old, { ...fresh, status: 'queued' }], [])).pass, false);
});
test('a newer skipped approval job vetoes older success, so unrelated-label approval runs must revalidate', () => {
  const newer = execution(34234164814, 242, 3);
  const skippedJob = { ...job(3, newer), conclusion: 'skipped' };
  const metadata = evidence([fresh, newer], [job(2), skippedJob]);
  const checks = [check(2, 2), check(3, 3, 'skipped')];
  assert.deepEqual(evaluateChecks([name], checks, head, metadata).failed, [name]);
  skippedJob.conclusion = 'success';
  checks[1].conclusion = 'success';
  assert.equal(evaluateChecks([name], checks, head, metadata).pass, true);
});
test('rerun requires the latest available attempt of each job, not an old successful check', () => {
  const rerun = { ...fresh, run_attempt: 2 };
  assert.equal(evaluateChecks([name], [check(2, 2)], head, evidence([rerun], [job(2), job(3, rerun)])).pass, false);
  assert.equal(evaluateChecks([name], [check(2, 2), check(3, 2)], head, evidence([rerun], [job(3, rerun)])).pass, true);
});
test('foreign workflow with identical check name cannot satisfy the trusted workflow', () => {
  assert.equal(evaluateChecks([name], [check(2, 2)], head, evidence([{ ...fresh, workflow_id: 987 }])).pass, false);
});
test('partial rerun retains prior Typecheck and Build successes but newest Unit Tests failure wins', () => {
  const run = { ...fresh, workflow_id: 99, path: '.github/workflows/pr-gate.yml', event: 'pull_request', run_attempt: 2 };
  const names = ['Typecheck & Lint', 'Build', 'Unit Tests'];
  const jobs = names.map((name, index) => ({ ...job(index + 10, run), name, run_attempt: 1 }));
  jobs.push({ ...job(20, run), name: 'Unit Tests', run_attempt: 2 });
  const metadata = { workflows: [{ id: 99, path: run.path }], workflowRuns: [run], jobs };
  const checks = jobs.map((job) => ({ ...check(job.id, 2), name: job.name }));
  assert.equal(evaluateChecks(names, checks, head, metadata).pass, true);
  checks.at(-1).conclusion = 'failure';
  assert.deepEqual(evaluateChecks(names, checks, head, metadata).failed, ['Unit Tests']);
  checks.at(-1).status = 'queued';
  assert.deepEqual(evaluateChecks(names, checks, head, metadata).missing, ['Unit Tests']);
  run.status = 'queued';
  assert.equal(evaluateChecks(names, checks, head, metadata).pass, false);
});
test('missing or inconsistent workflow identity is rejected', () => {
  for (const mutation of [{ path: '.github/workflows/spoof.yml' }, { head_sha: 'b'.repeat(40) }, { run_attempt: undefined }]) {
    assert.throws(() => evaluateChecks([name], [check(2, 2)], head, evidence([{ ...fresh, ...mutation }])), /metadata/u);
  }
  assert.throws(() => evaluateChecks([name], [check(2, 2)], head), /metadata/u);
});
test('invalid workflow, job, and check IDs cannot match or certify success', () => {
  for (const id of [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => evaluateChecks([name], [check(2, 2)], head, { ...evidence(), workflows: [{ ...workflow, id }] }), /metadata/u);
    assert.throws(() => evaluateChecks([name], [check(id, 2)], head, evidence([fresh], [job(id)])), /metadata/u);
    assert.equal(evaluateChecks([name], [check(id, 2)], head, evidence()).pass, false);
  }
});
test('job/check status or conclusion disagreement rejects an otherwise green check', () => {
  for (const mutation of [{ status: 'queued' }, { status: undefined }, { conclusion: 'failure' }, { conclusion: undefined }]) {
    assert.equal(evaluateChecks([name], [check(2, 2)], head, evidence([fresh], [{ ...job(2), ...mutation }])).pass, false);
  }
});
test('label revocation invalidates old approval even before the replacement workflow is listed', () => {
  const metadata = { ...evidence(), authorizationChangedAt: Date.parse('2026-09-08T12:00:00Z') };
  metadata.workflowRuns = [ { ...fresh, run_started_at: '2026-09-08T11:59:59Z' } ];
  assert.equal(evaluateChecks([name], [check(2, 2)], head, metadata).pass, false);
  metadata.workflowRuns[0].run_started_at = '2026-09-08T12:00:00Z';
  assert.equal(evaluateChecks([name], [check(2, 2)], head, metadata).pass, false);
  metadata.workflowRuns[0].run_started_at = '2026-09-08T12:00:01Z';
  metadata.jobs[0].started_at = '2026-09-08T12:00:01Z';
  assert.equal(evaluateChecks([name], [check(2, 2)], head, metadata).pass, true);
});
function apiFixture({ drift = {}, identity = workflow } = {}) {
  return async (route) => {
    if (route.startsWith('actions/workflows/')) return identity;
    if (route.startsWith('actions/runs?')) return { workflow_runs: [old, fresh] };
    if (route.startsWith('issues/')) return [{ event: 'unlabeled', label: { name: 'phase5a0d-intentional-redesign-approved' }, created_at: '2026-09-08T12:00:00Z' }];
    if (route.includes('/jobs?filter=all')) return { jobs: [job(2)] };
    if (route === `actions/runs/${fresh.id}`) return { ...fresh, ...drift };
    throw new Error(`unexpected-route:${route}`);
  };
}
test('collector obtains workflow identity, latest-attempt jobs and current authorization epoch through API', async () => {
  const metadata = await collectWorkflowEvidence(apiFixture(), [name], head, 1362);
  assert.deepEqual(metadata.workflows, [workflow]);
  assert.deepEqual(metadata.jobs, [job(2)]);
  assert.equal(metadata.authorizationChangedAt, Date.parse('2026-09-08T12:00:00Z'));
});
test('collector rejects spoofed workflow identity and a rerun/head race during collection', async () => {
  await assert.rejects(collectWorkflowEvidence(apiFixture({ identity: { ...workflow, path: '.github/workflows/spoof.yml' } }), [name], head, 1362), /identity/u);
  for (const drift of [{ run_attempt: 2 }, { head_sha: 'b'.repeat(40) }, { status: 'queued' }]) {
    await assert.rejects(collectWorkflowEvidence(apiFixture({ drift }), [name], head, 1362), /changed-during-collection/u);
  }
});
test('polling reuses completed-attempt jobs but still discovers a newer queued execution', async () => {
  const calls = [];
  let queued = false;
  const baseApi = apiFixture();
  const api = async (route) => {
    calls.push(route);
    if (queued && route.startsWith('actions/runs?')) return { workflow_runs: [old, fresh, execution(34234164814, 242, 3, { status: 'queued' })] };
    return baseApi(route);
  };
  const cache = { workflows: new Map(), jobs: new Map() };
  await collectWorkflowEvidence(api, [name], head, 1362, cache);
  await collectWorkflowEvidence(api, [name], head, 1362, cache);
  assert.equal(calls.filter((route) => route.startsWith('actions/workflows/')).length, 1);
  assert.equal(calls.filter((route) => route.includes('/jobs?')).length, 1);
  assert.equal(calls.filter((route) => route.startsWith('actions/runs?')).length, 2);
  queued = true;
  const metadata = await collectWorkflowEvidence(api, [name], head, 1362, cache);
  assert.equal(evaluateChecks([name], [check(2, 2)], head, metadata).pass, false);
});
