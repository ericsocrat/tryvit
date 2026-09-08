import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { newestTrustedRun } from './risk-workflows.mjs';

const checks = {
  dependencies: ['npm Audit (frontend)', 'pip Audit (Python pipeline)'],
  database: ['DB Integrity'],
  visual: ['Verify immutable visual baselines', 'Verify renderer/runtime attestation'],
  workflow: ['CI Policy Tests'],
};

export function classifyChanges(paths) {
  const risk = { dependencies: false, database: false, scoring: false, visual: false, workflow: false, browserSensitive: false, python: false };
  for (const file of paths) {
    if (typeof file !== 'string' || !file || file.startsWith('/') || file.includes('\\') || file.split('/').includes('..')) throw new Error('invalid-changed-path');
    if (/^(?:frontend\/package(?:-lock)?\.json|requirements[^/]*\.txt|pyproject\.toml)$/u.test(file)) risk.dependencies = true;
    if (/^(?:supabase\/|db\/|pipeline\/|data-quality\/)|\.py$/u.test(file)) risk.database = true;
    if (/scor(?:e|ing)|nutrition|provenance|evidence|allergen/iu.test(file) && !file.startsWith('docs/')) risk.scoring = true;
    if (/^frontend\/|^supabase\/(?:migrations\/|config\.toml)/u.test(file)) risk.visual = true;
    if (/^\.github\/|^scripts\/ci\//u.test(file)) risk.workflow = true;
    if (/camera|scanner|ocr|service.worker|middleware|proxy\./iu.test(file) || file.toLowerCase().endsWith('.css')) risk.browserSensitive = true;
    if (/\.py$|^requirements|^pyproject/u.test(file)) risk.python = true;
    // Changing the classifier or its execution boundary must exercise every lane.
    if (/^scripts\/ci\/|^\.github\/workflows\//u.test(file)) for (const key of Object.keys(risk)) risk[key] = true;
    // New execution/configuration surfaces must be reviewed before they can
    // acquire a cheap path. Documentation remains a deliberately low-risk case.
    if (!/^docs\/|\.md$|^frontend\/|^supabase\/|^db\/|^pipeline\/|^data-quality\/|^\.github\/|^scripts\/ci\/|\.py$|^requirements[^/]*\.(?:txt|in)$|^pyproject\.toml$/u.test(file)) {
      for (const key of Object.keys(risk)) risk[key] = true;
    }
  }
  return risk;
}

export function isBaselineOnly(paths) {
  return paths.length > 0 && paths.every((file) => file === 'frontend/e2e/__screenshots__/phase5a0d-manifest.json' || /^frontend\/e2e\/__screenshots__\/(?:[^/]+\/)*p5a0d-[^/]+\.png$/u.test(file));
}

export function requiredChecks(risk, baselineOnly = false) {
  const selected = [...new Set(['Typecheck & Lint', 'Unit Tests', 'Build', 'Playwright Smoke', 'CI Policy Tests',
    ...Object.entries(checks).flatMap(([key, names]) => risk[key] ? names : []),
    ...(risk.scoring ? ['Unit Tests'] : [])])];
  // A baseline-only replacement must satisfy the independent owner-approval
  // validator, not an ordinary pixel comparator intentionally delegated by it.
  return selected.map((name) => baselineOnly && name === 'Verify immutable visual baselines' ? 'Validate intentional baseline acceptance' : name);
}

export function mergeTrustedRisk(head, base) {
  const keys = ['dependencies', 'database', 'scoring', 'visual', 'workflow', 'browserSensitive', 'python'];
  for (const value of [head, base]) if (!value || keys.some((key) => typeof value[key] !== 'boolean')) throw new Error('invalid-risk-contract');
  return Object.fromEntries(keys.map((key) => [key, head[key] || base[key]]));
}

export function trustedBaseRisk(base, head, readTrusted = (file) => execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })) {
  let source;
  try { source = readTrusted('scripts/ci/change-risk.mjs'); }
  catch {
    // First introduction or unexpected removal cannot classify itself low-risk.
    return Object.fromEntries(Object.keys(classifyChanges([])).map((key) => [key, true]));
  }
  const directory = mkdtempSync(path.join(tmpdir(), 'tryvit-risk-policy-'));
  try {
    const file = path.join(directory, 'trusted-policy.mjs');
    writeFileSync(file, source);
    if (source.includes("from './risk-workflows.mjs'")) writeFileSync(path.join(directory, 'risk-workflows.mjs'), readTrusted('scripts/ci/risk-workflows.mjs'));
    return JSON.parse(execFileSync(process.execPath, [file, 'classify', base, head], { encoding: 'utf8', env: { ...process.env, RISK_BASELINE_ONLY: 'true', GITHUB_OUTPUT: '' }, timeout: 30_000 }));
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

export function evaluateChecks(expected, runs, headSha, metadata) {
  const missing = [];
  const failed = [];
  for (const name of expected) {
    const execution = newestTrustedRun(name, metadata, headSha);
    if (!execution || execution.status !== 'completed') { missing.push(name); continue; }
    // A prior green approval cannot survive revocation while the new event's
    // workflow is still absent from the eventually consistent Actions list.
    if (/intentional baseline acceptance|renderer\/runtime/u.test(name) && metadata.authorizationChangedAt != null
      && !(Date.parse(execution.run_started_at) > metadata.authorizationChangedAt)) { missing.push(name); continue; }
    const candidates = metadata.jobs.filter((job) => job.name === name && job.head_sha === headSha && job.run_id === execution.id);
    if (candidates.some((job) => !Number.isSafeInteger(job.run_attempt) || job.run_attempt < 1 || job.run_attempt > execution.run_attempt)) throw new Error('invalid-job-attempt-metadata');
    const latestAttempt = Math.max(...candidates.map((job) => job.run_attempt));
    const jobs = candidates.filter((job) => job.run_attempt === latestAttempt);
    if (jobs.some((job) => !Number.isSafeInteger(job.id) || job.id <= 0)) throw new Error('invalid-job-id-metadata');
    if (/intentional baseline acceptance|renderer\/runtime/u.test(name) && metadata.authorizationChangedAt != null
      && jobs.some((job) => !(Date.parse(job.started_at) > metadata.authorizationChangedAt))) { missing.push(name); continue; }
    const latest = runs.filter((run) => Number.isSafeInteger(run.id) && run.id > 0 && run.name === name && run.head_sha === headSha && run.app?.slug === 'github-actions'
      && run.check_suite?.id === execution.check_suite_id && jobs.some((job) => job.id === run.id));
    if (jobs.length !== 1 || latest.length !== 1 || latest.some((run) => run.status !== 'completed')) missing.push(name);
    else if (latest.some((run) => run.conclusion !== 'success' || jobs[0].status !== run.status || jobs[0].conclusion !== run.conclusion)) failed.push(name);
  }
  return { pass: !missing.length && !failed.length, missing, failed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] === 'classify') {
      const [base, head] = process.argv.slice(3);
      if (![base, head].every((sha) => /^[a-f0-9]{40}$/u.test(sha ?? ''))) throw new Error('exact-shas-required');
      const files = execFileSync('git', ['diff', '--name-only', '-z', base, head], { encoding: 'utf8' }).split('\0').filter(Boolean);
      const currentRisk = classifyChanges(files);
      const risk = process.env.RISK_BASELINE_ONLY === 'true' ? currentRisk : mergeTrustedRisk(currentRisk, trustedBaseRisk(base, head));
      process.stdout.write(`${JSON.stringify(risk)}\n`);
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `risk=${JSON.stringify(risk)}\nchecks=${JSON.stringify(requiredChecks(risk, isBaselineOnly(files)))}\n`);
    } else if (process.argv[2] === 'evaluate') {
      const evidence = JSON.parse(readFileSync(process.argv[3], 'utf8'));
      const result = evaluateChecks(JSON.parse(process.env.EXPECTED_CHECKS), evidence.check_runs, process.env.HEAD_SHA, evidence.metadata);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exitCode = result.pass ? 0 : result.failed.length ? 1 : 2;
    } else throw new Error('unknown-command');
  } catch (error) {
    process.stderr.write(`Change risk gate: ${error.message}\n`);
    process.exitCode = 1;
  }
}
