// Paths are owned by the trusted base checkout, never supplied by the PR.
export const trustedCheckWorkflows = {
  'Typecheck & Lint': 'pr-gate.yml',
  'Unit Tests': 'pr-gate.yml',
  Build: 'pr-gate.yml',
  'Playwright Smoke': 'pr-gate.yml',
  'CI Policy Tests': 'pr-gate.yml',
  'npm Audit (frontend)': 'dependency-audit.yml',
  'pip Audit (Python pipeline)': 'dependency-audit.yml',
  'DB Integrity': 'qa.yml',
  'Verify immutable visual baselines': 'phase5a0d-visual-baselines.yml',
  'Validate intentional baseline acceptance': 'phase5a0d-intentional-redesign.yml',
  'Verify renderer/runtime attestation': 'phase5a0d-renderer-attestation.yml',
};

export function newestTrustedRun(name, metadata, headSha) {
  const filename = trustedCheckWorkflows[name];
  const workflow = metadata?.workflows?.find((item) => item.path === `.github/workflows/${filename}`);
  if (!filename || !Number.isSafeInteger(workflow?.id) || workflow.id <= 0) throw new Error('missing-trusted-workflow-metadata');
  const runs = metadata.workflowRuns.filter((run) => run.workflow_id === workflow.id);
  for (const run of runs) {
    if (run.path !== workflow.path || run.head_sha !== headSha || !['pull_request', 'pull_request_target'].includes(run.event)
      || !['id', 'run_number', 'run_attempt', 'check_suite_id'].every((key) => Number.isSafeInteger(run[key]) && run[key] > 0)) {
      throw new Error('invalid-workflow-run-metadata');
    }
  }
  return runs.sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
}

export async function collectWorkflowEvidence(api, expected, headSha, prNumber, cache = { workflows: new Map(), jobs: new Map() }) {
  const filenames = [...new Set(expected.map((name) => trustedCheckWorkflows[name]))];
  if (filenames.includes(undefined)) throw new Error('unknown-required-check');
  const workflows = await Promise.all(filenames.map(async (file) => {
    if (!cache.workflows.has(file)) cache.workflows.set(file, await api(`actions/workflows/${file}`));
    return cache.workflows.get(file);
  }));
  for (const [index, workflow] of workflows.entries()) {
    if (workflow.path !== `.github/workflows/${filenames[index]}` || !Number.isSafeInteger(workflow.id) || workflow.id <= 0) throw new Error('invalid-workflow-identity');
  }
  const workflowRuns = [];
  for (let page = 1; page <= 10; page++) {
    const response = await api(`actions/runs?head_sha=${headSha}&per_page=100&page=${page}`);
    if (!Array.isArray(response.workflow_runs)) throw new Error('invalid-workflow-runs-response');
    workflowRuns.push(...response.workflow_runs);
    if (response.workflow_runs.length < 100) break;
    if (page === 10) throw new Error('workflow-pagination-limit');
  }
  const metadata = { workflows, workflowRuns: workflowRuns.filter((run) => workflows.some((workflow) => workflow.id === run.workflow_id)), jobs: [], authorizationChangedAt: null };
  if (expected.some((name) => /intentional baseline acceptance|renderer\/runtime/u.test(name))) {
    if (!/^\d+$/u.test(String(prNumber))) throw new Error('missing-authorization-pr-number');
    for (let page = 1; page <= 10; page++) {
      const events = await api(`issues/${prNumber}/events?per_page=100&page=${page}`);
      if (!Array.isArray(events)) throw new Error('invalid-authorization-events');
      for (const event of events) {
        if (!['labeled', 'unlabeled'].includes(event.event) || !['phase5a0d-intentional-redesign-approved', 'phase5a0d-renderer-attestation-approved'].includes(event.label?.name)) continue;
        const timestamp = Date.parse(event.created_at);
        if (!Number.isFinite(timestamp)) throw new Error('invalid-authorization-event-time');
        metadata.authorizationChangedAt = Math.max(metadata.authorizationChangedAt ?? 0, timestamp);
      }
      if (events.length < 100) break;
      if (page === 10) throw new Error('authorization-pagination-limit');
    }
  }
  const selected = [...new Map(expected.map((name) => { const run = newestTrustedRun(name, metadata, headSha); return [run?.id, run]; })).values()].filter(Boolean);
  for (const run of selected) {
    // Discover current executions on every poll; only completed-attempt jobs
    // are reusable. Queued/new attempts therefore invalidate prior evidence.
    if (run.status !== 'completed') continue;
    const cacheKey = JSON.stringify([run.id, run.run_attempt, run.updated_at, run.status, run.conclusion]);
    if (cache.jobs.has(cacheKey)) { metadata.jobs.push(...cache.jobs.get(cacheKey)); continue; }
    const jobs = [];
    for (let page = 1; page <= 10; page++) {
      // GitHub's filter=all includes prior executions. Keep the newest attempt
      // per job at evaluation time so rerun-failed-jobs retains earlier success.
      const response = await api(`actions/runs/${run.id}/jobs?filter=all&per_page=100&page=${page}`);
      if (!Array.isArray(response.jobs)) throw new Error('invalid-workflow-jobs-response');
      jobs.push(...response.jobs);
      if (response.jobs.length < 100) break;
      if (page === 10) throw new Error('jobs-pagination-limit');
    }
    const current = await api(`actions/runs/${run.id}`);
    for (const key of ['id', 'workflow_id', 'path', 'head_sha', 'run_attempt', 'status', 'conclusion', 'updated_at']) {
      if (current[key] !== run[key]) throw new Error('workflow-run-changed-during-collection');
    }
    cache.jobs.set(cacheKey, jobs);
    metadata.jobs.push(...jobs);
  }
  return metadata;
}
