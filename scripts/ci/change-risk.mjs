import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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

function trustedBaseRisk(base, head) {
  let source;
  try { source = execFileSync('git', ['show', `${base}:scripts/ci/change-risk.mjs`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch {
    // First introduction or unexpected removal cannot classify itself low-risk.
    return Object.fromEntries(Object.keys(classifyChanges([])).map((key) => [key, true]));
  }
  const directory = mkdtempSync(path.join(tmpdir(), 'tryvit-risk-policy-'));
  try {
    const file = path.join(directory, 'trusted-policy.mjs');
    writeFileSync(file, source);
    return JSON.parse(execFileSync(process.execPath, [file, 'classify', base, head], { encoding: 'utf8', env: { ...process.env, RISK_BASELINE_ONLY: 'true', GITHUB_OUTPUT: '' }, timeout: 30_000 }));
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

export function evaluateChecks(expected, runs, headSha) {
  const missing = [];
  const failed = [];
  for (const name of expected) {
    const candidates = runs.filter((run) => run.name === name && run.head_sha === headSha && run.app?.slug === 'github-actions');
    // Latest attempt wins, but another workflow cannot masquerade under a duplicate name.
    const byWorkflow = new Map();
    for (const run of candidates) {
      const key = run.check_suite?.id ?? run.details_url?.match(/actions\/runs\/(\d+)/u)?.[1] ?? 'unknown';
      const previous = byWorkflow.get(key);
      if (!previous || run.id > previous.id) byWorkflow.set(key, run);
    }
    const latest = [...byWorkflow.values()];
    if (!latest.length || latest.some((run) => run.status !== 'completed')) missing.push(name);
    else if (latest.some((run) => run.conclusion !== 'success')) failed.push(name);
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
      const result = evaluateChecks(JSON.parse(process.env.EXPECTED_CHECKS), JSON.parse(readFileSync(process.argv[3], 'utf8')).check_runs, process.env.HEAD_SHA);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exitCode = result.pass ? 0 : result.failed.length ? 1 : 2;
    } else throw new Error('unknown-command');
  } catch (error) {
    process.stderr.write(`Change risk gate: ${error.message}\n`);
    process.exitCode = 1;
  }
}
