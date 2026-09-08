import assert from 'node:assert/strict';
import test from 'node:test';
import { publishRiskGate } from './await-risk-checks.mjs';

const head = 'a'.repeat(40);
const goodCheck = { name: 'Unit Tests', id: 1, head_sha: head, check_suite: { id: 1 }, app: { slug: 'github-actions' }, status: 'completed', conclusion: 'success' };
const workflow = { id: 1, path: '.github/workflows/pr-gate.yml' };
const execution = { id: 1, workflow_id: 1, path: workflow.path, head_sha: head, event: 'pull_request', run_number: 1, run_attempt: 1, check_suite_id: 1, status: 'completed', conclusion: 'success' };
function fixture({ checks = [goodCheck], heads = [head], labels = [[]], createHead = head } = {}) {
  const calls = [];
  let headIndex = 0;
  const api = async (route, method = 'GET', body) => {
    calls.push({ route, method, body });
    if (route === 'pulls/42') {
      const index = headIndex++;
      return { head: { sha: heads[Math.min(index, heads.length - 1)] }, labels: labels[Math.min(index, labels.length - 1)] };
    }
    if (route === 'actions/workflows/pr-gate.yml') return workflow;
    if (route.startsWith('actions/runs?')) return { workflow_runs: [execution] };
    if (route.includes('/jobs?')) return { jobs: [{ id: 1, name: 'Unit Tests', head_sha: head, run_id: 1, run_attempt: 1, status: 'completed', conclusion: 'success' }] };
    if (route === 'actions/runs/1') return execution;
    if (route === 'check-runs' && method === 'POST') return { id: 99, head_sha: createHead };
    if (route.startsWith('commits/')) return { check_runs: checks };
    if (route === 'check-runs/99' && method === 'PATCH') return { id: 99 };
    throw new Error('unexpected-test-call');
  };
  return { calls, options: { api, headSha: head, prNumber: '42', expected: ['Unit Tests'], now: () => 1_000, sleep: async () => {} } };
}
test('creates and completes a custom check on the PR head, not the base SHA', async () => {
  const f = fixture();
  assert.deepEqual(await publishRiskGate(f.options), { checkRunId: 99, headSha: head, conclusion: 'success' });
  const create = f.calls.find((call) => call.method === 'POST');
  assert.equal(create.body.name, 'Change Risk Gate');
  assert.equal(create.body.head_sha, head);
  assert.equal(create.body.status, 'in_progress');
  assert.equal(f.calls.at(-1).body.conclusion, 'success');
});
test('stale head before creation cannot receive a passing check', async () => {
  const f = fixture({ heads: ['b'.repeat(40)] });
  await assert.rejects(publishRiskGate(f.options), /pr-head-changed/u);
  assert.ok(!f.calls.some((call) => call.method === 'POST'));
});
test('head change between collection and publication completes old check as cancelled', async () => {
  const f = fixture({ heads: [head, head, 'b'.repeat(40)] });
  await assert.rejects(publishRiskGate(f.options), /pr-head-changed/u);
  assert.equal(f.calls.at(-1).body.conclusion, 'cancelled');
});
test('applicable failures and timeouts explicitly complete a failure check', async () => {
  const f = fixture({ checks: [{ ...goodCheck, conclusion: 'skipped' }] });
  await assert.rejects(publishRiskGate(f.options), /applicable-check-failed/u);
  assert.equal(f.calls.at(-1).body.conclusion, 'failure');
  const pending = fixture({ checks: [] });
  let ticks = 0;
  await assert.rejects(publishRiskGate({ ...pending.options, timeoutMs: 1, now: () => ++ticks * 1000 }), /applicable-check-missing/u);
  assert.equal(pending.calls.at(-1).body.conclusion, 'failure');
});
test('unexpected create response cannot be certified as the requested head', async () => {
  const f = fixture({ createHead: 'b'.repeat(40) });
  await assert.rejects(publishRiskGate(f.options), /created-check-head-mismatch/u);
});
test('label revocation between collection and publication produces failure', async () => {
  const f = fixture({ labels: [[{ name: 'phase5a0d-intentional-redesign-approved' }], [{ name: 'phase5a0d-intentional-redesign-approved' }], []] });
  await assert.rejects(publishRiskGate(f.options), /pr-labels-changed/u);
  assert.equal(f.calls.at(-1).body.conclusion, 'failure');
});
test('unrelated labels do not cancel the risk gate', async () => {
  const f = fixture({ labels: [[], [{ name: 'size/L' }]] });
  assert.equal((await publishRiskGate(f.options)).conclusion, 'success');
});
