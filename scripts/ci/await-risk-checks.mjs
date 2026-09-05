import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateChecks } from './change-risk.mjs';

export async function publishRiskGate({ api, headSha, prNumber, expected, now = Date.now, sleep = (ms) => new Promise((done) => setTimeout(done, ms)), onCreated = () => {}, timeoutMs = 65 * 60 * 1000 }) {
  if (!/^[a-f0-9]{40}$/u.test(headSha ?? '') || !/^\d+$/u.test(String(prNumber)) || !Array.isArray(expected) || !expected.length || expected.some((name) => typeof name !== 'string')) throw new Error('invalid-risk-gate-inputs');
  const assertCurrentHead = async () => {
    const pr = await api(`pulls/${prNumber}`);
    if (pr.head.sha !== headSha) throw new Error('pr-head-changed');
  };
  // pull_request_target jobs attach to the base commit. Publish a distinct
  // explicit head check; the base-owned job must not share this context name.
  await assertCurrentHead();
  const check = await api('check-runs', 'POST', { name: 'Change Risk Gate', head_sha: headSha, status: 'in_progress', started_at: new Date(now()).toISOString() });
  if (!Number.isSafeInteger(check.id) || check.head_sha !== headSha) throw new Error('created-check-head-mismatch');
  onCreated(check.id);
  let conclusion = 'failure';
  let summary = 'Risk assessment did not complete.';
  try {
    const deadline = now() + timeoutMs;
    while (true) {
      await assertCurrentHead();
      const runs = [];
      for (let page = 1; page <= 10; page++) {
        const response = await api(`commits/${headSha}/check-runs?per_page=100&page=${page}&filter=latest`);
        if (!Array.isArray(response.check_runs)) throw new Error('invalid-check-run-response');
        runs.push(...response.check_runs);
        if (response.check_runs.length < 100) break;
        if (page === 10) throw new Error('check-pagination-limit');
      }
      const result = evaluateChecks(expected, runs, headSha);
      if (result.pass) {
        // Reject a head change even between collection and final publication.
        await assertCurrentHead();
        conclusion = 'success';
        summary = 'Every applicable exact-head check passed.';
        return { checkRunId: check.id, headSha, conclusion };
      }
      if (result.failed.length) throw new Error(`applicable-check-failed: ${result.failed.join(', ')}`);
      if (now() > deadline) throw new Error(`applicable-check-missing-or-incomplete: ${result.missing.join(', ')}`);
      await sleep(30_000);
    }
  } catch (error) {
    conclusion = error.message === 'pr-head-changed' ? 'cancelled' : 'failure';
    summary = error.message;
    throw error;
  } finally {
    await api(`check-runs/${check.id}`, 'PATCH', { status: 'completed', conclusion, completed_at: new Date(now()).toISOString(), output: { title: 'Change Risk Gate', summary } });
  }
}

async function main() {
  const { GITHUB_REPOSITORY: repository, HEAD_SHA: headSha, GH_TOKEN: token, PR_NUMBER: prNumber } = process.env;
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repository ?? '') || !token) throw new Error('invalid-repository-access');
  const api = async (route, method = 'GET', body) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${route}`, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`github-check-query-http-${response.status}`);
    return response.json();
  };
  await publishRiskGate({ api, headSha, prNumber, expected: JSON.parse(process.env.EXPECTED_CHECKS ?? 'null') });
  process.stdout.write('Change Risk Gate: PASS published on the exact PR head.\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`Change Risk Gate stopped: ${error.message}\n`); process.exitCode = 1; });
}
